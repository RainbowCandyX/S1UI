mod client;
mod commands;
mod config;
mod error;
mod models;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::s1_login,
            commands::s1_logout,
            commands::s1_whoami,
            commands::s1_load_saved_credentials,
            commands::s1_clear_saved_credentials,
            commands::s1_load_proxy_settings,
            commands::s1_save_proxy_settings,
            commands::s1_test_proxy,
            commands::s1_dashboard_counts,
            commands::s1_list_agents,
            commands::s1_count_agents,
            commands::s1_agent_action,
            commands::s1_enable_agent,
            commands::s1_disable_agent,
            commands::s1_list_threats,
            commands::s1_threat_action,
            commands::s1_threat_verdict,
            commands::s1_threat_incident_status,
            commands::s1_list_sites,
            commands::s1_list_groups,
            commands::s1_list_exclusions,
            commands::s1_list_restrictions,
            commands::s1_create_exclusion,
            commands::s1_create_restriction,
            commands::s1_delete_exclusions,
            commands::s1_delete_restrictions,
            commands::s1_dv_init_query,
            commands::s1_dv_query_status,
            commands::s1_dv_events,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用失败");
}
