use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::prelude::*;
use rand::RngCore;
use std::collections::BTreeMap;
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

// 固定内嵌 key — 对应本地 obfuscation（非真 KMS 级安全）。
// 目的：ini 文件中 token 不是明文，肉眼/cat 看不到原值。
const KEY: [u8; 32] = [
    0x9c, 0x7a, 0x2b, 0x11, 0xd4, 0x5e, 0x3f, 0x8a, 0x62, 0x17, 0xc5, 0xae, 0x04, 0x91, 0xf2, 0x63,
    0x88, 0x1d, 0xbe, 0x52, 0x4c, 0xa7, 0x36, 0xe0, 0x75, 0xf9, 0x21, 0x6a, 0xcb, 0x80, 0x3d, 0x19,
];

#[derive(Debug, Default, Clone)]
pub struct SavedCredentials {
    pub hostname: String,
    pub api_token: String,
}

#[derive(Debug, Default, Clone)]
pub struct ProxyConfig {
    pub enabled: bool,
    pub proxy_type: String, // "http" | "socks5"
    pub url: String,
}

fn config_path() -> PathBuf {
    // 优先用可执行文件同级目录，其次 CWD；保证"当前目录"语义
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            return dir.join("s1ui.ini");
        }
    }
    Path::new("s1ui.ini").to_path_buf()
}

fn encrypt(plain: &[u8]) -> io::Result<String> {
    let cipher = Aes256Gcm::new_from_slice(&KEY)
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let ct = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), plain)
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
    // 格式：base64(nonce) | base64(ct)
    Ok(format!(
        "{}|{}",
        BASE64_STANDARD.encode(nonce_bytes),
        BASE64_STANDARD.encode(ct),
    ))
}

fn decrypt(encoded: &str) -> io::Result<String> {
    let (n_b64, c_b64) = encoded
        .split_once('|')
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "missing nonce separator"))?;
    let nonce_bytes = BASE64_STANDARD
        .decode(n_b64.trim())
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
    let ct = BASE64_STANDARD
        .decode(c_b64.trim())
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
    if nonce_bytes.len() != 12 {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "bad nonce length"));
    }
    let cipher = Aes256Gcm::new_from_slice(&KEY)
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
    let plain = cipher
        .decrypt(Nonce::from_slice(&nonce_bytes), ct.as_ref())
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
    String::from_utf8(plain).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))
}

// ---- 极简 ini 读写 ----

fn parse_ini(text: &str) -> BTreeMap<String, BTreeMap<String, String>> {
    let mut out: BTreeMap<String, BTreeMap<String, String>> = BTreeMap::new();
    let mut section = String::new();
    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with(';') {
            continue;
        }
        if let Some(inner) = line.strip_prefix('[').and_then(|s| s.strip_suffix(']')) {
            section = inner.trim().to_string();
            out.entry(section.clone()).or_default();
            continue;
        }
        if let Some((k, v)) = line.split_once('=') {
            out.entry(section.clone())
                .or_default()
                .insert(k.trim().to_string(), v.trim().to_string());
        }
    }
    out
}

fn write_ini(path: &Path, map: &BTreeMap<String, BTreeMap<String, String>>) -> io::Result<()> {
    let mut buf = String::new();
    let mut first = true;
    for (section, kvs) in map {
        if !first {
            buf.push('\n');
        }
        buf.push_str(&format!("[{section}]\n"));
        for (k, v) in kvs {
            buf.push_str(&format!("{k} = {v}\n"));
        }
        first = false;
    }
    let mut f = fs::File::create(path)?;
    f.write_all(buf.as_bytes())?;
    Ok(())
}

pub fn load() -> Option<SavedCredentials> {
    let path = config_path();
    let text = fs::read_to_string(&path).ok()?;
    let ini = parse_ini(&text);
    let auth = ini.get("auth")?;
    let hostname = auth.get("hostname")?.clone();
    let encoded = auth.get("api_token_enc")?;
    let api_token = decrypt(encoded).ok()?;
    Some(SavedCredentials {
        hostname,
        api_token,
    })
}

pub fn save(c: &SavedCredentials) -> io::Result<()> {
    let path = config_path();
    let encoded = encrypt(c.api_token.as_bytes())?;
    // 保留其他 section（如 [proxy]）
    let mut ini: BTreeMap<String, BTreeMap<String, String>> = fs::read_to_string(&path)
        .ok()
        .map(|t| parse_ini(&t))
        .unwrap_or_default();
    let auth = ini.entry("auth".to_string()).or_default();
    auth.insert("hostname".to_string(), c.hostname.clone());
    auth.insert("api_token_enc".to_string(), encoded);
    auth.remove("verify_ssl"); // 清理旧配置中的残留字段
    write_ini(&path, &ini)
}

pub fn load_proxy() -> Option<ProxyConfig> {
    let path = config_path();
    let text = fs::read_to_string(&path).ok()?;
    let ini = parse_ini(&text);
    let section = ini.get("proxy")?;
    let enabled = section
        .get("enabled")
        .map(|s| s.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let proxy_type = section
        .get("proxy_type")
        .cloned()
        .unwrap_or_else(|| "http".to_string());
    let url = if let Some(enc) = section.get("url_enc") {
        decrypt(enc).ok()?
    } else {
        section.get("url").cloned().unwrap_or_default()
    };
    Some(ProxyConfig {
        enabled,
        proxy_type,
        url,
    })
}

pub fn save_proxy(p: &ProxyConfig) -> io::Result<()> {
    let path = config_path();
    // 读取现有 ini 保留其他 section（如 [auth]）
    let mut ini: BTreeMap<String, BTreeMap<String, String>> = fs::read_to_string(&path)
        .ok()
        .map(|t| parse_ini(&t))
        .unwrap_or_default();

    let proxy = ini.entry("proxy".to_string()).or_default();
    proxy.insert("enabled".to_string(), p.enabled.to_string());
    proxy.insert("proxy_type".to_string(), p.proxy_type.clone());
    proxy.remove("url");
    if p.url.is_empty() {
        proxy.remove("url_enc");
    } else {
        let encoded = encrypt(p.url.as_bytes())?;
        proxy.insert("url_enc".to_string(), encoded);
    }

    write_ini(&path, &ini)
}

pub fn clear() -> io::Result<()> {
    let path = config_path();
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}
