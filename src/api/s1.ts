import { invoke } from "@tauri-apps/api/core";

export interface LoginPayload {
  hostname: string;
  apiToken: string;
}

export interface UserInfo {
  id?: string;
  email?: string;
  full_name?: string;
  scope?: string;
}

export interface PageParams {
  limit?: number;
  cursor?: string;
  query?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  // 原样透传给 S1 的附加筛选键值
  [key: string]: unknown;
}

export interface Paginated<T> {
  data: T[];
  pagination: {
    totalItems?: number;
    nextCursor?: string | null;
  };
}

export interface Agent {
  id: string;
  computer_name?: string;
  account_name?: string;
  site_name?: string;
  group_name?: string;
  os_name?: string;
  os_type?: string;
  agent_version?: string;
  is_active?: boolean;
  is_up_to_date?: boolean;
  infected?: boolean;
  last_active_date?: string;
  external_ip?: string;
  network_status?: string;
  machine_type?: string;
  domain?: string;
}

export interface Threat {
  id: string;
  threat_name?: string;
  classification?: string;
  confidence_level?: string;
  mitigation_status?: string;
  incident_status?: string;
  agent_computer_name?: string;
  agent_os_type?: string;
  file_path?: string;
  file_sha1?: string;
  created_at?: string;
  engines?: string[];
  analyst_verdict?: string;
}

export interface Site {
  id: string;
  name?: string;
  state?: string;
  account_name?: string;
  total_licenses?: number;
  active_licenses?: number;
  creator?: string;
  expiration?: string;
}

export interface Group {
  id: string;
  name?: string;
  site_id?: string;
  site_name?: string;
  type?: string;
  rank?: number;
  total_agents?: number;
  creator?: string;
}

export interface Exclusion {
  id: string;
  value?: string;
  type?: string;
  os_type?: string;
  mode?: string;
  description?: string;
  source?: string;
  scope?: string;
  created_at?: string;
}

export interface DashboardCounts {
  agents_total: number;
  agents_active: number;
  agents_infected: number;
  agents_out_of_date: number;
  threats_unresolved: number;
  threats_total: number;
}

// ---- 封装 invoke，统一错误形态 ----
async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    // Rust 侧返回字符串错误
    throw new Error(typeof e === "string" ? e : JSON.stringify(e));
  }
}

export const s1 = {
  login: (p: LoginPayload) =>
    call<UserInfo>("s1_login", {
      hostname: p.hostname,
      apiToken: p.apiToken,
    }),
  logout: () => call<void>("s1_logout"),
  whoami: () => call<UserInfo>("s1_whoami"),
  loadSavedCredentials: () =>
    call<null | { hostname: string; api_token: string }>("s1_load_saved_credentials"),
  clearSavedCredentials: () => call<void>("s1_clear_saved_credentials"),
  loadProxySettings: () =>
    call<ProxySettings>("s1_load_proxy_settings"),
  saveProxySettings: (settings: ProxySettings) =>
    call<void>("s1_save_proxy_settings", { settings }),
  testProxy: (settings: ProxySettings) =>
    call<string>("s1_test_proxy", { settings }),

  dashboardCounts: () => call<DashboardCounts>("s1_dashboard_counts"),

  listAgents: (params: PageParams) =>
    call<Paginated<Agent>>("s1_list_agents", { params }),
  countAgents: (params: PageParams) =>
    call<number>("s1_count_agents", { params }),
  agentAction: (action: string, ids: string[], filter?: Record<string, unknown>) =>
    call<{ affected: number }>("s1_agent_action", { action, ids, filter }),
  enableAgent: (ids: string[], shouldReboot?: boolean) =>
    call<{ affected: number }>("s1_enable_agent", { ids, shouldReboot }),
  disableAgent: (ids: string[], shouldReboot?: boolean, expiration?: string) =>
    call<{ affected: number }>("s1_disable_agent", { ids, shouldReboot, expiration }),

  listThreats: (params: PageParams) =>
    call<Paginated<Threat>>("s1_list_threats", { params }),
  threatAction: (
    action: string,
    ids: string[],
    filter?: Record<string, unknown>,
  ) => call<{ affected: number }>("s1_threat_action", { action, ids, filter }),
  threatVerdict: (ids: string[], verdict: string) =>
    call<{ affected: number }>("s1_threat_verdict", { ids, verdict }),
  threatIncidentStatus: (ids: string[], status: string) =>
    call<{ affected: number }>("s1_threat_incident_status", { ids, status }),

  listSites: (params: PageParams) =>
    call<Paginated<Site>>("s1_list_sites", { params }),

  listGroups: (params: PageParams) =>
    call<Paginated<Group>>("s1_list_groups", { params }),

  listExclusions: (params: PageParams) =>
    call<Paginated<Exclusion>>("s1_list_exclusions", { params }),
  listRestrictions: (params: PageParams) =>
    call<Paginated<Exclusion>>("s1_list_restrictions", { params }),
  createExclusion: (data: Record<string, unknown>, scope?: Record<string, unknown>) =>
    call<unknown>("s1_create_exclusion", { data, scope }),
  createRestriction: (data: Record<string, unknown>, scope?: Record<string, unknown>) =>
    call<unknown>("s1_create_restriction", { data, scope }),
  deleteExclusions: (exclType: string, ids: string[]) =>
    call<{ affected: number }>("s1_delete_exclusions", { exclType, ids }),
  deleteRestrictions: (exclType: string, ids: string[]) =>
    call<{ affected: number }>("s1_delete_restrictions", { exclType, ids }),

  // -- Deep Visibility ----
  dvInitQuery: (query: string, fromDate: string, toDate: string) =>
    call<{ query_id: string }>("s1_dv_init_query", { query, fromDate, toDate }),
  dvQueryStatus: (queryId: string) =>
    call<{ progress_status?: number; response_state?: string; response_error?: string }>(
      "s1_dv_query_status",
      { queryId },
    ),
  dvEvents: (queryId: string, limit?: number, cursor?: string) =>
    call<Paginated<DVEvent>>("s1_dv_events", { queryId, limit, cursor }),
};

export interface ProxySettings {
  enabled: boolean;
  proxy_type: "http" | "socks5";
  url: string;
}

export interface DVEvent {
  id: string;
  event_type?: string;
  event_time?: string;
  agent_name?: string;
  agent_os?: string;
  site_name?: string;
  process_name?: string;
  src_proc_pid?: string;
  src_proc_cmd_line?: string;
  src_proc_user?: string;
  src_proc_image_path?: string;
  tgt_proc_name?: string;
  tgt_proc_cmd_line?: string;
  file_path?: string;
  tgt_file_path?: string;
  tgt_file_size?: string;
  file_sha256?: string;
  file_md5?: string;
  src_ip?: string;
  dst_ip?: string;
  dst_port?: string;
  direction?: string;
  dns_request?: string;
  dns_response?: string;
  registry_path?: string;
  url?: string;
}
