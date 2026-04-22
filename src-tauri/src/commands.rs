use crate::client::{normalize_proxy_url, params_to_query, Session};
use crate::config;
use crate::error::{S1Error, S1Result};
use crate::models::{
    json_bool, json_flex_str, json_i64, json_str, json_u64, ActionResult, Agent, DVEvent,
    DVQueryInit, DVQueryStatus, DashboardCounts, Exclusion, Group, Paginated, Pagination, Site,
    Threat, UserInfo,
};
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub session: Mutex<Option<Session>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            session: Mutex::new(None),
        }
    }
}

fn current_session(state: &State<'_, AppState>) -> S1Result<Session> {
    let guard = state.session.lock().map_err(|e| S1Error::Other(e.to_string()))?;
    guard.clone().ok_or(S1Error::NotAuthenticated)
}

// ========== 认证 ==========

#[tauri::command]
pub async fn s1_login(
    state: State<'_, AppState>,
    hostname: String,
    api_token: String,
) -> S1Result<UserInfo> {
    // 读取代理设置；未启用则传 None（no_proxy）
    let proxy = config::load_proxy()
        .filter(|p| p.enabled && !p.url.is_empty())
        .map(|p| (p.proxy_type, p.url));
    let session = Session::new(&hostname, &api_token, proxy)?;
    // 探测性调用 /users/login/by-api-token 等价端点：/users/me 可能不存在。
    // 我们用 /system/info 作为 token 有效性验证。
    let _ = session.get("system/info", &[]).await?;

    // 尝试取一次 /users/login/by-api-token/verify 或 /users/2fa/status 不稳定，
    // 这里用 /users/me（v2.1 常见端点），失败则用空信息。
    let who = session.get("users/me", &[]).await.unwrap_or(Value::Null);
    let data = who.get("data").unwrap_or(&Value::Null);

    let meta = UserInfo {
        id: json_str(data, "id"),
        email: json_str(data, "email"),
        full_name: json_str(data, "fullName"),
        scope: json_str(data, "scope"),
    };

    {
        let mut g = state.session.lock().map_err(|e| S1Error::Other(e.to_string()))?;
        *g = Some(session);
    }

    // 登录成功后加密保存到 ini，下次启动自动预填
    if let Err(e) = config::save(&config::SavedCredentials {
        hostname: hostname.clone(),
        api_token: api_token.clone(),
    }) {
        log::warn!("无法保存凭据: {e}");
    }

    Ok(meta)
}

#[derive(serde::Serialize)]
pub struct SavedCredentialsDto {
    pub hostname: String,
    pub api_token: String,
}

#[tauri::command]
pub async fn s1_load_saved_credentials() -> S1Result<Option<SavedCredentialsDto>> {
    Ok(config::load().map(|c| SavedCredentialsDto {
        hostname: c.hostname,
        api_token: c.api_token,
    }))
}

#[tauri::command]
pub async fn s1_clear_saved_credentials() -> S1Result<()> {
    config::clear().map_err(|e| S1Error::Other(e.to_string()))?;
    Ok(())
}

// ========== Proxy ==========

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ProxyDto {
    pub enabled: bool,
    pub proxy_type: String, // "http" | "socks5"
    pub url: String,
}

#[tauri::command]
pub async fn s1_load_proxy_settings() -> S1Result<ProxyDto> {
    Ok(config::load_proxy()
        .map(|p| ProxyDto {
            enabled: p.enabled,
            proxy_type: p.proxy_type,
            url: p.url,
        })
        .unwrap_or(ProxyDto {
            enabled: false,
            proxy_type: "http".into(),
            url: String::new(),
        }))
}

#[tauri::command]
pub async fn s1_save_proxy_settings(
    state: State<'_, AppState>,
    settings: ProxyDto,
) -> S1Result<()> {
    // 先落盘
    config::save_proxy(&config::ProxyConfig {
        enabled: settings.enabled,
        proxy_type: settings.proxy_type.clone(),
        url: settings.url.clone(),
    })
    .map_err(|e| S1Error::Other(e.to_string()))?;

    // 若当前已登录，立即用新代理重建 Session —— 本次生效，不需重登
    let mut guard = state
        .session
        .lock()
        .map_err(|e| S1Error::Other(e.to_string()))?;
    if let Some(old) = guard.as_ref() {
        let hostname = old.base.to_string();
        let token = old.token.clone();
        let proxy = if settings.enabled && !settings.url.trim().is_empty() {
            Some((settings.proxy_type, settings.url))
        } else {
            None
        };
        let rebuilt = Session::new(&hostname, &token, proxy)?;
        *guard = Some(rebuilt);
    }
    Ok(())
}

/// 用给定代理配置直接测试（不依赖已保存的设置）。
/// - enabled=false 时 no_proxy 直连
/// - enabled=true 时按 type+url 构造代理
/// 请求 https://api.ipify.org 返回出口 IP，两秒超时。
#[tauri::command]
pub async fn s1_test_proxy(settings: ProxyDto) -> S1Result<String> {
    use std::time::Duration;

    let mut builder = reqwest::Client::builder()
        .user_agent("s1ui-proxy-test/0.1")
        .timeout(Duration::from_secs(10));

    if settings.enabled && !settings.url.trim().is_empty() {
        let url = normalize_proxy_url(&settings.proxy_type, &settings.url);
        let p = reqwest::Proxy::all(&url)
            .map_err(|e| S1Error::Other(format!("无效代理 URL: {e}")))?;
        builder = builder.proxy(p);
    } else {
        builder = builder.no_proxy();
    }

    let client = builder
        .build()
        .map_err(|e| S1Error::Other(e.to_string()))?;

    // 国内常用的 IP 归属查询：返回形如 "当前 IP：1.2.3.4  来自于：..."
    let url = "https://myip.ipip.net";
    match client.get(url).send().await {
        Ok(resp) => {
            let status = resp.status();
            if !status.is_success() {
                return Err(S1Error::Other(format!("HTTP {}", status.as_u16())));
            }
            let body = resp.text().await.unwrap_or_default();
            // 按用户要求：把 "中国 台湾" 替换为 "中华民国"
            let body = body.replace("中国 台湾", "中华民国");
            Ok(body.trim().to_string())
        }
        Err(e) => Err(S1Error::Other(e.to_string())),
    }
}

#[tauri::command]
pub async fn s1_logout(state: State<'_, AppState>) -> S1Result<()> {
    let mut g = state.session.lock().map_err(|e| S1Error::Other(e.to_string()))?;
    *g = None;
    Ok(())
}

#[tauri::command]
pub async fn s1_whoami(state: State<'_, AppState>) -> S1Result<UserInfo> {
    let session = current_session(&state)?;
    let resp = session.get("users/me", &[]).await?;
    let data = resp.get("data").unwrap_or(&Value::Null);
    Ok(UserInfo {
        id: json_str(data, "id"),
        email: json_str(data, "email"),
        full_name: json_str(data, "fullName"),
        scope: json_str(data, "scope"),
    })
}

// ========== 分页辅助 ==========

fn pagination_from(resp: &Value) -> Pagination {
    let p = resp.get("pagination").cloned().unwrap_or(Value::Null);
    Pagination {
        total_items: json_u64(&p, "totalItems"),
        next_cursor: json_str(&p, "nextCursor"),
    }
}

// ========== Agents ==========

fn agent_from(v: &Value) -> Agent {
    Agent {
        id: json_str(v, "id").unwrap_or_default(),
        computer_name: json_str(v, "computerName"),
        account_name: json_str(v, "accountName"),
        site_name: json_str(v, "siteName"),
        group_name: json_str(v, "groupName"),
        os_name: json_str(v, "osName"),
        os_type: json_str(v, "osType"),
        agent_version: json_str(v, "agentVersion"),
        is_active: json_bool(v, "isActive"),
        is_up_to_date: json_bool(v, "isUpToDate"),
        infected: json_bool(v, "infected"),
        last_active_date: json_str(v, "lastActiveDate"),
        external_ip: json_str(v, "externalIp"),
        network_status: json_str(v, "networkStatus"),
        machine_type: json_str(v, "machineType"),
        domain: json_str(v, "domain"),
    }
}

#[tauri::command]
pub async fn s1_list_agents(
    state: State<'_, AppState>,
    params: Value,
) -> S1Result<Paginated<Agent>> {
    let session = current_session(&state)?;
    let q = params_to_query(&params);
    let resp = session.get("agents", &q).await?;
    let data = resp
        .get("data")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(Paginated {
        data: data.iter().map(agent_from).collect(),
        pagination: pagination_from(&resp),
    })
}

#[tauri::command]
pub async fn s1_count_agents(state: State<'_, AppState>, params: Value) -> S1Result<u64> {
    let session = current_session(&state)?;
    let q = params_to_query(&params);
    let resp = session.get("agents/count", &q).await?;
    // /agents/count 返回 {"data":{"total":N}}
    let total = resp
        .get("data")
        .and_then(|d| d.get("total"))
        .and_then(|t| t.as_u64())
        .unwrap_or(0);
    Ok(total)
}

/// Agent 动作映射：key → (HTTP 端点, 是否需要 body)
fn map_agent_action(action: &str) -> Option<&'static str> {
    match action {
        "disconnect" => Some("agents/actions/disconnect"),
        "connect" => Some("agents/actions/connect"),
        "shutdown" => Some("agents/actions/shutdown"),
        "restart" => Some("agents/actions/restart-machine"),
        "initiate-scan" => Some("agents/actions/initiate-scan"),
        "abort-scan" => Some("agents/actions/abort-scan"),
        "fetch-logs" => Some("agents/actions/fetch-logs"),
        "uninstall" => Some("agents/actions/uninstall"),
        "update-software" => Some("agents/actions/update-software"),
        "mark-as-up-to-date" => Some("agents/actions/mark-as-up-to-date"),
        "move-to-site" => Some("agents/actions/move-to-site"),
        _ => None,
    }
}

#[tauri::command]
pub async fn s1_agent_action(
    state: State<'_, AppState>,
    action: String,
    ids: Vec<String>,
    filter: Option<Value>,
) -> S1Result<ActionResult> {
    let session = current_session(&state)?;
    let endpoint =
        map_agent_action(&action).ok_or_else(|| S1Error::Other(format!("未知动作: {action}")))?;

    let mut body_filter = filter.unwrap_or_else(|| json!({}));
    if !ids.is_empty() {
        body_filter
            .as_object_mut()
            .ok_or_else(|| S1Error::Other("filter 必须是对象".into()))?
            .insert("ids".into(), json!(ids));
    }
    let body = json!({ "filter": body_filter });
    let resp = session.post(endpoint, body).await?;
    let affected = resp
        .get("data")
        .and_then(|d| d.get("affected"))
        .and_then(|x| x.as_u64())
        .unwrap_or(ids.len() as u64);
    Ok(ActionResult { affected })
}

#[tauri::command]
pub async fn s1_enable_agent(
    state: State<'_, AppState>,
    ids: Vec<String>,
    should_reboot: Option<bool>,
) -> S1Result<ActionResult> {
    let session = current_session(&state)?;
    let fallback = ids.len() as u64;
    let body = json!({
        "filter": { "ids": ids },
        "data": { "shouldReboot": should_reboot.unwrap_or(false) }
    });
    let resp = session.post("agents/actions/enable-agent", body).await?;
    let affected = resp
        .get("data")
        .and_then(|d| d.get("affected"))
        .and_then(|x| x.as_u64())
        .unwrap_or(fallback);
    Ok(ActionResult { affected })
}

#[tauri::command]
pub async fn s1_disable_agent(
    state: State<'_, AppState>,
    ids: Vec<String>,
    should_reboot: Option<bool>,
    expiration: Option<String>,
) -> S1Result<ActionResult> {
    let session = current_session(&state)?;
    let fallback = ids.len() as u64;
    let mut data = json!({ "shouldReboot": should_reboot.unwrap_or(false) });
    if let Some(exp) = expiration {
        if let Some(obj) = data.as_object_mut() {
            obj.insert("expiration".into(), Value::String(exp));
        }
    }
    let body = json!({ "filter": { "ids": ids }, "data": data });
    let resp = session.post("agents/actions/disable-agent", body).await?;
    let affected = resp
        .get("data")
        .and_then(|d| d.get("affected"))
        .and_then(|x| x.as_u64())
        .unwrap_or(fallback);
    Ok(ActionResult { affected })
}

// ========== Threats ==========

fn threat_from(v: &Value) -> Threat {
    // v2.1 威胁返回结构是嵌套：{threatInfo:{...}, agentRealtimeInfo:{...}, ...}
    let ti = v.get("threatInfo").unwrap_or(v);
    let ag = v.get("agentRealtimeInfo").unwrap_or(&Value::Null);
    Threat {
        id: json_str(v, "id")
            .or_else(|| json_str(ti, "id"))
            .unwrap_or_default(),
        threat_name: json_str(ti, "threatName"),
        classification: json_str(ti, "classification"),
        confidence_level: json_str(ti, "confidenceLevel"),
        mitigation_status: json_str(ti, "mitigationStatus"),
        incident_status: json_str(ti, "incidentStatus"),
        agent_computer_name: json_str(ag, "agentComputerName"),
        agent_os_type: json_str(ag, "agentOsType"),
        file_path: json_str(ti, "filePath"),
        file_sha1: json_str(ti, "sha1"),
        created_at: json_str(ti, "createdAt"),
        analyst_verdict: json_str(ti, "analystVerdict"),
    }
}

#[tauri::command]
pub async fn s1_list_threats(
    state: State<'_, AppState>,
    params: Value,
) -> S1Result<Paginated<Threat>> {
    let session = current_session(&state)?;
    let q = params_to_query(&params);
    let resp = session.get("threats", &q).await?;
    let data = resp
        .get("data")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(Paginated {
        data: data.iter().map(threat_from).collect(),
        pagination: pagination_from(&resp),
    })
}

fn map_threat_action(action: &str) -> Option<String> {
    // 只负责 mitigate/{a} 和 blacklist/exclusions；verdict 与 incident 由独立 command 处理
    let mitigate = [
        "kill",
        "quarantine",
        "remediate",
        "rollback-remediation",
        "un-quarantine",
    ];
    if let Some(a) = mitigate.iter().find(|a| format!("mitigate-{a}") == action) {
        return Some(format!("threats/mitigate/{a}"));
    }
    match action {
        "add-to-blacklist" => Some("threats/add-to-blacklist".into()),
        "add-to-exclusions" => Some("threats/add-to-exclusions".into()),
        _ => None,
    }
}

#[tauri::command]
pub async fn s1_threat_action(
    state: State<'_, AppState>,
    action: String,
    ids: Vec<String>,
    filter: Option<Value>,
) -> S1Result<ActionResult> {
    let session = current_session(&state)?;
    let endpoint = map_threat_action(&action)
        .ok_or_else(|| S1Error::Other(format!("未知威胁动作: {action}")))?;

    let mut body_filter = filter.unwrap_or_else(|| json!({}));
    if !ids.is_empty() {
        body_filter
            .as_object_mut()
            .ok_or_else(|| S1Error::Other("filter 必须是对象".into()))?
            .insert("ids".into(), json!(ids));
    }
    let body = json!({ "filter": body_filter });
    let resp = session.post(&endpoint, body).await?;
    let affected = resp
        .get("data")
        .and_then(|d| d.get("affected"))
        .and_then(|x| x.as_u64())
        .unwrap_or(ids.len() as u64);
    Ok(ActionResult { affected })
}

#[tauri::command]
pub async fn s1_threat_verdict(
    state: State<'_, AppState>,
    ids: Vec<String>,
    verdict: String,
) -> S1Result<ActionResult> {
    let session = current_session(&state)?;
    let fallback = ids.len() as u64;
    let body = json!({
        "filter": { "ids": ids },
        "data": { "analystVerdict": verdict }
    });
    let resp = session.post("threats/analyst-verdict", body).await?;
    let affected = resp
        .get("data")
        .and_then(|d| d.get("affected"))
        .and_then(|x| x.as_u64())
        .unwrap_or(fallback);
    Ok(ActionResult { affected })
}

#[tauri::command]
pub async fn s1_threat_incident_status(
    state: State<'_, AppState>,
    ids: Vec<String>,
    status: String,
) -> S1Result<ActionResult> {
    let session = current_session(&state)?;
    let fallback = ids.len() as u64;
    let body = json!({
        "filter": { "ids": ids },
        "data": { "incidentStatus": status }
    });
    let resp = session.post("threats/incident", body).await?;
    let affected = resp
        .get("data")
        .and_then(|d| d.get("affected"))
        .and_then(|x| x.as_u64())
        .unwrap_or(fallback);
    Ok(ActionResult { affected })
}

// ========== Sites ==========

fn site_from(v: &Value) -> Site {
    let id = json_str(v, "id")
        .or_else(|| v.get("id").and_then(|x| x.as_i64()).map(|n| n.to_string()))
        .unwrap_or_default();
    let name = json_str(v, "name")
        .filter(|s| !s.is_empty())
        .or_else(|| Some(id.clone()));
    Site {
        id,
        name,
        state: json_str(v, "state"),
        account_name: json_str(v, "accountName"),
        total_licenses: json_u64(v, "totalLicenses"),
        active_licenses: json_u64(v, "activeLicenses"),
        creator: json_str(v, "creator"),
        expiration: json_str(v, "expiration"),
    }
}

#[tauri::command]
pub async fn s1_list_sites(
    state: State<'_, AppState>,
    params: Value,
) -> S1Result<Paginated<Site>> {
    let session = current_session(&state)?;
    let q = params_to_query(&params);
    let resp = session.get("sites", &q).await?;
    // /sites 的 data 可能有两种形态：
    //   A) 扁平数组     → data: [...]
    //   B) 嵌套 sites 字段 → data: { sites: [...], allSites: {...} }
    let arr = if let Some(a) = resp.get("data").and_then(|d| d.as_array()) {
        a.clone()
    } else if let Some(a) = resp
        .get("data")
        .and_then(|d| d.get("sites"))
        .and_then(|x| x.as_array())
    {
        a.clone()
    } else {
        Vec::new()
    };
    Ok(Paginated {
        data: arr.iter().map(site_from).collect(),
        pagination: pagination_from(&resp),
    })
}

// ========== Groups ==========

fn group_from(v: &Value) -> Group {
    // S1 的 /groups 返回字段有时缺 name；按 Android 参考项目用 id 兜底
    let id = json_str(v, "id")
        .or_else(|| v.get("id").and_then(|x| x.as_i64()).map(|n| n.to_string()))
        .unwrap_or_default();
    let name = json_str(v, "name").filter(|s| !s.is_empty()).or_else(|| Some(id.clone()));
    Group {
        id,
        name,
        site_id: json_str(v, "siteId"),
        site_name: json_str(v, "siteName"),
        r#type: json_str(v, "type"),
        rank: json_i64(v, "rank"),
        total_agents: json_u64(v, "totalAgents"),
        creator: json_str(v, "creator"),
    }
}

#[tauri::command]
pub async fn s1_list_groups(
    state: State<'_, AppState>,
    params: Value,
) -> S1Result<Paginated<Group>> {
    let session = current_session(&state)?;
    let q = params_to_query(&params);
    let resp = session.get("groups", &q).await?;
    let arr = resp
        .get("data")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(Paginated {
        data: arr.iter().map(group_from).collect(),
        pagination: pagination_from(&resp),
    })
}

// ========== Exclusions ==========

fn exclusion_from(v: &Value) -> Exclusion {
    // S1 返回 scope 是对象 {tenant:true} / {siteIds:[...]} / ...；scopeName 是展示字符串
    // 参考 C++ 项目 ExclusionsPage.cpp 用 obj["scopeName"]
    let scope = json_str(v, "scopeName")
        .or_else(|| json_str(v, "scopePath"))
        .or_else(|| {
            v.get("scope").and_then(|s| s.as_object()).and_then(|o| {
                if o.get("tenant").and_then(|x| x.as_bool()).unwrap_or(false) {
                    Some("Global".to_string())
                } else if o.contains_key("siteIds") {
                    Some("Site".to_string())
                } else if o.contains_key("groupIds") {
                    Some("Group".to_string())
                } else if o.contains_key("accountIds") {
                    Some("Account".to_string())
                } else {
                    None
                }
            })
        });
    Exclusion {
        id: json_str(v, "id").unwrap_or_default(),
        value: json_str(v, "value"),
        r#type: json_str(v, "type"),
        os_type: json_str(v, "osType"),
        mode: json_str(v, "mode"),
        description: json_str(v, "description"),
        source: json_str(v, "source"),
        scope,
        created_at: json_str(v, "createdAt"),
    }
}

/// S1 的 exclusions / restrictions 端点需要 includeChildren / includeParents
/// 才能跨越 scope 拉全部可见条目（不传就只返回当前 token 的直接 scope 内容，通常是空）。
/// 不要默认传 tenant=true —— site-scoped token 会 403。
fn ensure_defaults(params: &Value, pairs: &[(&str, &str)]) -> Vec<(String, String)> {
    let mut q = params_to_query(params);
    for (k, v) in pairs {
        if !q.iter().any(|(qk, _)| qk == k) {
            q.push(((*k).into(), (*v).into()));
        }
    }
    q
}

/// S1 的 exclusions/restrictions 总条数通常数百到数千；为了让前端能按内置标志整体过滤，
/// 这里在服务端直接循环 cursor 拉全部。硬上限 MAX_PAGES 防死循环。
const MAX_EXCL_PAGES: u32 = 50; // 50 页 × limit 1000 = 5 万条上限

async fn fetch_all(session: &Session, endpoint: &str, base_query: &[(String, String)]) -> S1Result<Vec<Value>> {
    let mut out: Vec<Value> = Vec::new();
    let mut cursor: Option<String> = None;
    for _ in 0..MAX_EXCL_PAGES {
        let mut q: Vec<(String, String)> = base_query.to_vec();
        // 始终用 1000（S1 上限）
        q.retain(|(k, _)| k != "limit" && k != "cursor");
        q.push(("limit".into(), "1000".into()));
        if let Some(c) = &cursor {
            q.push(("cursor".into(), c.clone()));
        }
        let resp = session.get(endpoint, &q).await?;
        if let Some(arr) = resp.get("data").and_then(|x| x.as_array()) {
            out.extend(arr.iter().cloned());
        }
        match resp
            .get("pagination")
            .and_then(|p| p.get("nextCursor"))
            .and_then(|c| c.as_str())
        {
            Some(c) if !c.is_empty() => cursor = Some(c.to_string()),
            _ => return Ok(out),
        }
    }
    Ok(out)
}

#[tauri::command]
pub async fn s1_list_exclusions(
    state: State<'_, AppState>,
    params: Value,
) -> S1Result<Paginated<Exclusion>> {
    let session = current_session(&state)?;
    let base = ensure_defaults(
        &params,
        &[("includeChildren", "true"), ("includeParents", "true")],
    );
    let arr = fetch_all(&session, "exclusions", &base).await?;
    let total = arr.len() as u64;
    Ok(Paginated {
        data: arr.iter().map(exclusion_from).collect(),
        pagination: crate::models::Pagination {
            total_items: Some(total),
            next_cursor: None,
        },
    })
}

#[tauri::command]
pub async fn s1_list_restrictions(
    state: State<'_, AppState>,
    params: Value,
) -> S1Result<Paginated<Exclusion>> {
    let session = current_session(&state)?;
    let base = ensure_defaults(
        &params,
        &[("includeChildren", "true"), ("includeParents", "true")],
    );
    let arr = fetch_all(&session, "restrictions", &base).await?;
    let total = arr.len() as u64;
    Ok(Paginated {
        data: arr.iter().map(exclusion_from).collect(),
        pagination: crate::models::Pagination {
            total_items: Some(total),
            next_cursor: None,
        },
    })
}

// ========== Create / Delete Exclusions & Restrictions ==========

fn scope_filter(scope: Option<Value>) -> Value {
    scope.unwrap_or_else(|| json!({ "tenant": true }))
}

async fn create_with_scope(
    session: &Session,
    endpoint: &str,
    data: Value,
    scope: Option<Value>,
) -> S1Result<Value> {
    let body = json!({ "data": data, "filter": scope_filter(scope) });
    session.post(endpoint, body).await
}

#[tauri::command]
pub async fn s1_create_exclusion(
    state: State<'_, AppState>,
    data: Value,
    scope: Option<Value>,
) -> S1Result<Value> {
    let session = current_session(&state)?;
    create_with_scope(&session, "exclusions", data, scope).await
}

#[tauri::command]
pub async fn s1_create_restriction(
    state: State<'_, AppState>,
    data: Value,
    scope: Option<Value>,
) -> S1Result<Value> {
    let session = current_session(&state)?;
    create_with_scope(&session, "restrictions", data, scope).await
}

async fn delete_by_type_ids(
    session: &Session,
    endpoint: &str,
    excl_type: String,
    ids: Vec<String>,
) -> S1Result<ActionResult> {
    let fallback = ids.len() as u64;
    let body = json!({
        "data": { "type": excl_type, "ids": ids.join(",") }
    });
    let resp = session
        .request(reqwest::Method::DELETE, endpoint, None, Some(body))
        .await?;
    let affected = resp
        .get("data")
        .and_then(|d| d.get("affected"))
        .and_then(|x| x.as_u64())
        .unwrap_or(fallback);
    Ok(ActionResult { affected })
}

#[tauri::command]
pub async fn s1_delete_exclusions(
    state: State<'_, AppState>,
    excl_type: String,
    ids: Vec<String>,
) -> S1Result<ActionResult> {
    let session = current_session(&state)?;
    delete_by_type_ids(&session, "exclusions", excl_type, ids).await
}

#[tauri::command]
pub async fn s1_delete_restrictions(
    state: State<'_, AppState>,
    excl_type: String,
    ids: Vec<String>,
) -> S1Result<ActionResult> {
    let session = current_session(&state)?;
    delete_by_type_ids(&session, "restrictions", excl_type, ids).await
}

// ========== Dashboard ==========

#[tauri::command]
pub async fn s1_dashboard_counts(state: State<'_, AppState>) -> S1Result<DashboardCounts> {
    let session = current_session(&state)?;

    // 用 /agents/count 的不同 filter 取统计。若某个调用失败则置 0。
    async fn count(s: &Session, q: &[(String, String)]) -> u64 {
        s.get("agents/count", q)
            .await
            .ok()
            .and_then(|r| r.get("data").and_then(|d| d.get("total")).and_then(|x| x.as_u64()))
            .unwrap_or(0)
    }

    let agents_total = count(&session, &[]).await;
    let agents_active = count(&session, &[("isActive".into(), "true".into())]).await;
    let agents_infected = count(&session, &[("infected".into(), "true".into())]).await;
    let agents_out_of_date = count(&session, &[("isUpToDate".into(), "false".into())]).await;

    // Threats 用 /threats 的 countOnly=true（v2.1 支持）
    async fn threats_count(s: &Session, q: &[(String, String)]) -> u64 {
        s.get("threats", q)
            .await
            .ok()
            .and_then(|r| {
                r.get("pagination")
                    .and_then(|p| p.get("totalItems"))
                    .and_then(|x| x.as_u64())
            })
            .unwrap_or(0)
    }

    let threats_total = threats_count(
        &session,
        &[("limit".into(), "1".into()), ("countOnly".into(), "true".into())],
    )
    .await;
    let threats_unresolved = threats_count(
        &session,
        &[
            ("limit".into(), "1".into()),
            ("countOnly".into(), "true".into()),
            ("incidentStatuses".into(), "unresolved".into()),
        ],
    )
    .await;

    Ok(DashboardCounts {
        agents_total,
        agents_active,
        agents_infected,
        agents_out_of_date,
        threats_unresolved,
        threats_total,
    })
}

// ========== Deep Visibility ==========

#[tauri::command]
pub async fn s1_dv_init_query(
    state: State<'_, AppState>,
    query: String,
    from_date: String,
    to_date: String,
) -> S1Result<DVQueryInit> {
    let session = current_session(&state)?;
    let body = json!({
        "query": query,
        "fromDate": from_date,
        "toDate": to_date,
    });
    let resp = session.post("dv/init-query", body).await?;
    let query_id = resp
        .get("data")
        .and_then(|d| d.get("queryId"))
        .and_then(|x| x.as_str())
        .ok_or_else(|| S1Error::Other("S1 未返回 queryId".into()))?
        .to_string();
    Ok(DVQueryInit { query_id })
}

#[tauri::command]
pub async fn s1_dv_query_status(
    state: State<'_, AppState>,
    query_id: String,
) -> S1Result<DVQueryStatus> {
    let session = current_session(&state)?;
    let resp = session
        .get("dv/query-status", &[("queryId".into(), query_id)])
        .await?;
    let d = resp.get("data").unwrap_or(&Value::Null);
    Ok(DVQueryStatus {
        progress_status: json_i64(d, "progressStatus"),
        response_state: json_str(d, "responseState"),
        response_error: json_str(d, "responseError"),
    })
}

fn dv_event_from(v: &Value) -> DVEvent {
    DVEvent {
        id: json_flex_str(v, &["id"]).unwrap_or_default(),
        event_type: json_str(v, "eventType"),
        event_time: json_str(v, "eventTime").or_else(|| json_str(v, "createdAt")),
        agent_name: json_str(v, "agentName").or_else(|| json_str(v, "endpointName")),
        agent_os: json_str(v, "agentOs"),
        site_name: json_str(v, "siteName"),
        process_name: json_str(v, "processName").or_else(|| json_str(v, "srcProcName")),
        src_proc_pid: json_flex_str(v, &["srcProcPid", "pid"]),
        src_proc_cmd_line: json_str(v, "srcProcCmdLine").or_else(|| json_str(v, "processCmd")),
        src_proc_user: json_str(v, "srcProcUser"),
        src_proc_image_path: json_str(v, "srcProcImagePath")
            .or_else(|| json_str(v, "processImagePath")),
        tgt_proc_name: json_str(v, "tgtProcName"),
        tgt_proc_cmd_line: json_str(v, "tgtProcCmdLine"),
        file_path: json_str(v, "filePath"),
        // 参考 Python SDK Event 类所有可能 target file 字段：
        //   文件事件: tgtFilePath / fileFullName / fileLocation / tgtFileOldPath
        //   Module/Driver: modulePath / activeContentPath
        //   Process: processImagePath（当事件语义指向被启动/加载的 PE 时）
        tgt_file_path: json_str(v, "tgtFilePath")
            .or_else(|| json_str(v, "fileFullName"))
            .or_else(|| json_str(v, "fileLocation"))
            .or_else(|| json_str(v, "tgtFileOldPath"))
            .or_else(|| json_str(v, "modulePath"))
            .or_else(|| json_str(v, "activeContentPath"))
            .or_else(|| json_str(v, "processImagePath")),
        tgt_file_size: json_flex_str(v, &["tgtFileSize", "fileSize"]),
        file_sha256: json_str(v, "fileSha256"),
        file_md5: json_str(v, "fileMd5"),
        src_ip: json_str(v, "srcIp"),
        dst_ip: json_str(v, "dstIp"),
        dst_port: json_flex_str(v, &["dstPort"]),
        direction: json_str(v, "direction"),
        dns_request: json_str(v, "dnsRequest"),
        dns_response: json_str(v, "dnsResponse"),
        registry_path: json_str(v, "registryPath").or_else(|| json_str(v, "registryKeyPath")),
        url: json_str(v, "url").or_else(|| json_str(v, "networkUrl")),
    }
}

#[tauri::command]
pub async fn s1_dv_events(
    state: State<'_, AppState>,
    query_id: String,
    limit: Option<u32>,
    cursor: Option<String>,
) -> S1Result<Paginated<DVEvent>> {
    let session = current_session(&state)?;
    let mut q: Vec<(String, String)> = vec![
        ("queryId".into(), query_id),
        ("limit".into(), limit.unwrap_or(100).to_string()),
    ];
    if let Some(c) = cursor {
        if !c.is_empty() {
            q.push(("cursor".into(), c));
        }
    }
    let resp = session.get("dv/events", &q).await?;
    let arr = resp
        .get("data")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(Paginated {
        data: arr.iter().map(dv_event_from).collect(),
        pagination: pagination_from(&resp),
    })
}
