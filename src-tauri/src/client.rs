use crate::error::{S1Error, S1Result};
use reqwest::{header, Client, Method};
use serde_json::Value;
use url::Url;

pub const API_PREFIX: &str = "web/api/v2.1";

/// 单个会话的状态：hostname + token + reqwest client。
#[derive(Clone)]
pub struct Session {
    pub base: Url,
    pub token: String,
    pub http: Client,
}

impl Session {
    pub fn new(
        hostname: &str,
        token: &str,
        proxy: Option<(String, String)>,
    ) -> S1Result<Self> {
        // 允许用户写 "xxx.sentinelone.net" 或 "https://xxx/..."
        let raw = hostname.trim().trim_end_matches('/');
        let with_scheme = if raw.starts_with("http://") || raw.starts_with("https://") {
            raw.to_string()
        } else {
            format!("https://{raw}")
        };
        let base = Url::parse(&with_scheme)?;

        let mut headers = header::HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            header::HeaderValue::from_str(&format!("APIToken {token}"))
                .map_err(|e| S1Error::Other(format!("非法 token: {e}")))?,
        );
        headers.insert(
            header::ACCEPT,
            header::HeaderValue::from_static("application/json"),
        );
        headers.insert(
            header::CONTENT_TYPE,
            header::HeaderValue::from_static("application/json"),
        );

        // SSL 证书验证强制开启 —— 不暴露给上层关闭
        let mut builder = Client::builder()
            .default_headers(headers)
            .user_agent("s1ui/0.1 (+tauri)");

        if let Some((kind, raw_url)) = proxy {
            let proxy_url = normalize_proxy_url(&kind, &raw_url);
            let p = reqwest::Proxy::all(&proxy_url)
                .map_err(|e| S1Error::Other(format!("无效代理 URL: {e}")))?;
            builder = builder.proxy(p);
        } else {
            builder = builder.no_proxy();
        }

        let http = builder.build()?;

        Ok(Self {
            base,
            token: token.to_string(),
            http,
        })
    }

    /// 拼接 API 路径。例如 endpoint = "agents" → https://host/web/api/v2.1/agents
    fn url(&self, endpoint: &str) -> S1Result<Url> {
        // endpoint 允许带前导 /，统一清理
        let ep = endpoint.trim_start_matches('/');
        let joined = self.base.join(&format!("{API_PREFIX}/{ep}"))?;
        Ok(joined)
    }

    pub async fn request(
        &self,
        method: Method,
        endpoint: &str,
        query: Option<&[(String, String)]>,
        body: Option<Value>,
    ) -> S1Result<Value> {
        let url = self.url(endpoint)?;
        let mut req = self.http.request(method.clone(), url);
        if let Some(q) = query {
            req = req.query(q);
        }
        if let Some(b) = body {
            req = req.json(&b);
        }

        let resp = req.send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(S1Error::Api {
                status: status.as_u16(),
                body,
            });
        }

        // 某些 DELETE / POST action 返回空 body
        let text = resp.text().await?;
        if text.is_empty() {
            return Ok(Value::Null);
        }
        Ok(serde_json::from_str(&text)?)
    }

    pub async fn get(&self, endpoint: &str, query: &[(String, String)]) -> S1Result<Value> {
        self.request(Method::GET, endpoint, Some(query), None).await
    }

    pub async fn post(&self, endpoint: &str, body: Value) -> S1Result<Value> {
        self.request(Method::POST, endpoint, None, Some(body)).await
    }
}

/// 补全 proxy 方案前缀；用户可能只填 host:port。
pub fn normalize_proxy_url(kind: &str, raw: &str) -> String {
    let trimmed = raw.trim();
    let lower = trimmed.to_ascii_lowercase();
    if lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("socks5://")
        || lower.starts_with("socks5h://")
    {
        return trimmed.to_string();
    }
    match kind {
        "socks5" => format!("socks5://{trimmed}"),
        _ => format!("http://{trimmed}"),
    }
}

/// 把前端传来的 PageParams（JSON Object）展开成 (key,val) 元组数组。
/// 支持: 字符串/数字/布尔。数组会被 join 成逗号分隔（S1 通常用这个格式）。
pub fn params_to_query(params: &Value) -> Vec<(String, String)> {
    let mut out: Vec<(String, String)> = Vec::new();
    let Some(obj) = params.as_object() else {
        return out;
    };
    for (k, v) in obj {
        match v {
            Value::Null => {}
            Value::Bool(b) => out.push((k.clone(), b.to_string())),
            Value::Number(n) => out.push((k.clone(), n.to_string())),
            Value::String(s) if s.is_empty() => {}
            Value::String(s) => out.push((k.clone(), s.clone())),
            Value::Array(arr) => {
                let joined: Vec<String> = arr
                    .iter()
                    .filter_map(|x| match x {
                        Value::String(s) => Some(s.clone()),
                        Value::Number(n) => Some(n.to_string()),
                        Value::Bool(b) => Some(b.to_string()),
                        _ => None,
                    })
                    .collect();
                if !joined.is_empty() {
                    out.push((k.clone(), joined.join(",")));
                }
            }
            Value::Object(_) => {
                if let Ok(s) = serde_json::to_string(v) {
                    out.push((k.clone(), s));
                }
            }
        }
    }
    out
}
