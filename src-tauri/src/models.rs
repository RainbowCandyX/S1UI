use serde::{Deserialize, Serialize};
use serde_json::Value;

// 通用的分页包装。S1 API 返回 {"data":[...], "pagination":{...}}
#[derive(Debug, Serialize, Deserialize)]
pub struct Paginated<T> {
    pub data: Vec<T>,
    pub pagination: Pagination,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Pagination {
    #[serde(rename = "totalItems", skip_serializing_if = "Option::is_none")]
    pub total_items: Option<u64>,
    #[serde(rename = "nextCursor", skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub full_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
}

#[derive(Debug, Serialize, Default)]
pub struct NetworkInterface {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub inet: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub inet6: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub physical: Option<String>,
}

#[derive(Debug, Serialize, Default)]
pub struct Agent {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub computer_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub site_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub os_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub os_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub os_revision: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_active: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_up_to_date: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub infected: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_active_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registered_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_ip_to_connect: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub machine_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub domain: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uuid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_memory: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub core_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_threats: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub installer_type: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub network_interfaces: Vec<NetworkInterface>,
}

#[derive(Debug, Serialize, Default)]
pub struct Threat {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub threat_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub classification: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence_level: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mitigation_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub incident_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_computer_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_os_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_sha1: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub analyst_verdict: Option<String>,
}

#[derive(Debug, Serialize, Default)]
pub struct Site {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_licenses: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_licenses: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creator: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expiration: Option<String>,
}

#[derive(Debug, Serialize, Default)]
pub struct Group {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub site_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub site_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rank: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_agents: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creator: Option<String>,
}

#[derive(Debug, Serialize, Default)]
pub struct Exclusion {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub os_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Default)]
pub struct DashboardCounts {
    pub agents_total: u64,
    pub agents_active: u64,
    pub agents_infected: u64,
    pub agents_out_of_date: u64,
    pub threats_unresolved: u64,
    pub threats_total: u64,
}

#[derive(Debug, Serialize)]
pub struct ActionResult {
    pub affected: u64,
}

// ---------- Deep Visibility ----------

#[derive(Debug, Serialize)]
pub struct DVQueryInit {
    pub query_id: String,
}

#[derive(Debug, Serialize, Default)]
pub struct DVQueryStatus {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress_status: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_error: Option<String>,
}

/// 参考 iOS 的 DVEvent —— 取最常用字段（多字段有 fallback）。
#[derive(Debug, Serialize, Default)]
pub struct DVEvent {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_os: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub site_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub process_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub src_proc_pid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub src_proc_cmd_line: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub src_proc_user: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub src_proc_image_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tgt_proc_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tgt_proc_cmd_line: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tgt_file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tgt_file_size: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_sha256: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_md5: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub src_ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dst_ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dst_port: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dns_request: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dns_response: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registry_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

/// DV 某些字段是 number 或 string；统一成 string
pub fn json_flex_str(v: &Value, keys: &[&str]) -> Option<String> {
    for k in keys {
        if let Some(x) = v.get(*k) {
            if let Some(s) = x.as_str() {
                if !s.is_empty() {
                    return Some(s.to_string());
                }
            }
            if let Some(n) = x.as_i64() {
                return Some(n.to_string());
            }
            if let Some(n) = x.as_f64() {
                return Some(n.to_string());
            }
        }
    }
    None
}

// 用于解析未知结构 / S1 原始字段（camelCase）后再转为我们的 snake_case 模型
pub fn json_str(v: &Value, key: &str) -> Option<String> {
    v.get(key)
        .and_then(|x| x.as_str().map(|s| s.to_string()))
}
pub fn json_bool(v: &Value, key: &str) -> Option<bool> {
    v.get(key).and_then(|x| x.as_bool())
}
pub fn json_u64(v: &Value, key: &str) -> Option<u64> {
    v.get(key).and_then(|x| x.as_u64())
}
pub fn json_i64(v: &Value, key: &str) -> Option<i64> {
    v.get(key).and_then(|x| x.as_i64())
}
