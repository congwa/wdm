mod account;
mod ai_rules;
mod cascade_api;
mod chat_history;
mod cleanup;
mod code_tracker;
mod commands;
mod embedding;
mod extensions;
pub mod focus;
mod paths;
mod privacy;
mod scanner;
pub mod tray;
mod workspaces;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let tray_handle = tray::create_tray_handle();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(tray_handle.clone())
        .setup(move |app| {
            // Setup system tray
            let app_handle = app.handle().clone();
            if let Err(e) = tray::setup_tray(&app_handle, tray_handle.clone()) {
                eprintln!("[Tray] Failed to setup tray: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Dashboard
            commands::scan_dashboard,
            // Embedding
            commands::get_embedding_stats,
            commands::get_embedding_files,
            commands::get_embedding_projects,
            commands::get_embedding_commits,
            commands::get_embedding_context,
            commands::vacuum_embedding_db,
            commands::delete_project_index,
            // Account
            commands::get_account_data,
            // Extensions
            commands::get_extensions,
            // Workspaces
            commands::get_workspace_data,
            // Code Tracker
            commands::get_tracked_projects,
            commands::delete_tracked_project,
            // Chat History
            commands::get_chat_sessions,
            commands::parse_chat_content,
            commands::delete_chat_session,
            // Cascade API (encrypted chat via gRPC)
            commands::discover_cascade_server,
            commands::get_cascade_trajectories,
            commands::get_cascade_detail,
            // AI Rules
            commands::get_ai_rules_data,
            commands::save_global_rules,
            // Privacy
            commands::scan_privacy_risks,
            // Cleanup
            commands::get_cleanup_items,
            commands::execute_cleanup,
            // Focus
            commands::focus_windsurf,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
