use crate::paths::WindsurfPaths;
use crate::{account, ai_rules, cascade_api, chat_history, cleanup, code_tracker, embedding, extensions, focus, privacy, scanner, workspaces};

fn get_paths() -> Result<WindsurfPaths, String> {
    WindsurfPaths::new().ok_or_else(|| "Cannot determine home directory".to_string())
}

// ===== Dashboard =====

#[tauri::command]
pub async fn scan_dashboard() -> Result<scanner::DashboardOverview, String> {
    tokio::task::spawn_blocking(|| {
        let paths = get_paths()?;
        Ok(scanner::scan_dashboard(&paths))
    }).await.map_err(|e| e.to_string())?
}

// ===== Embedding Database =====

#[tauri::command]
pub async fn get_embedding_stats() -> Result<embedding::EmbeddingStats, String> {
    tokio::task::spawn_blocking(|| {
        let paths = get_paths()?;
        let db = paths.embedding_db().ok_or("Embedding database not found")?;
        embedding::get_stats(&db)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_embedding_files(limit: u32, offset: u32, search: String) -> Result<Vec<embedding::IndexedFile>, String> {
    tokio::task::spawn_blocking(move || {
        let paths = get_paths()?;
        let db = paths.embedding_db().ok_or("Embedding database not found")?;
        embedding::get_files(&db, limit, offset, &search)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_embedding_projects() -> Result<Vec<embedding::ProjectSummary>, String> {
    tokio::task::spawn_blocking(|| {
        let paths = get_paths()?;
        let db = paths.embedding_db().ok_or("Embedding database not found")?;
        embedding::get_projects(&db)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_embedding_commits(limit: u32) -> Result<Vec<embedding::IndexedCommit>, String> {
    tokio::task::spawn_blocking(move || {
        let paths = get_paths()?;
        let db = paths.embedding_db().ok_or("Embedding database not found")?;
        embedding::get_commits(&db, limit)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_embedding_context(limit: u32, offset: u32) -> Result<Vec<embedding::ContextItem>, String> {
    tokio::task::spawn_blocking(move || {
        let paths = get_paths()?;
        let db = paths.embedding_db().ok_or("Embedding database not found")?;
        embedding::get_context_items(&db, limit, offset)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn vacuum_embedding_db() -> Result<u64, String> {
    tokio::task::spawn_blocking(|| {
        let paths = get_paths()?;
        let db = paths.embedding_db().ok_or("Embedding database not found")?;
        embedding::vacuum_database(&db)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_project_index(corpus_name: String) -> Result<u64, String> {
    tokio::task::spawn_blocking(move || {
        let paths = get_paths()?;
        let db = paths.embedding_db().ok_or("Embedding database not found")?;
        embedding::delete_project_index(&db, &corpus_name)
    }).await.map_err(|e| e.to_string())?
}

// ===== Account =====

#[tauri::command]
pub async fn get_account_data() -> Result<account::AccountData, String> {
    tokio::task::spawn_blocking(|| {
        let paths = get_paths()?;
        account::get_account_data(&paths.state_vscdb())
    }).await.map_err(|e| e.to_string())?
}

// ===== Extensions =====

#[tauri::command]
pub async fn get_extensions() -> Result<Vec<extensions::ExtensionInfo>, String> {
    tokio::task::spawn_blocking(|| {
        let paths = get_paths()?;
        extensions::get_extensions(
            &paths.extensions_json(),
            &paths.windsurf_dot.join("extensions"),
            &paths.state_vscdb(),
        )
    }).await.map_err(|e| e.to_string())?
}

// ===== Workspaces =====

#[tauri::command]
pub async fn get_workspace_data() -> Result<workspaces::WorkspaceData, String> {
    tokio::task::spawn_blocking(|| {
        let paths = get_paths()?;
        workspaces::get_workspace_data(&paths.workspace_storage(), &paths.state_vscdb())
    }).await.map_err(|e| e.to_string())?
}

// ===== Code Tracker =====

#[tauri::command]
pub async fn get_tracked_projects() -> Result<Vec<code_tracker::TrackedProject>, String> {
    tokio::task::spawn_blocking(|| {
        let paths = get_paths()?;
        Ok(code_tracker::get_tracked_projects(
            &paths.code_tracker_legacy(),
            &paths.code_tracker_windsurf(),
        ))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_tracked_project(dir_name: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let paths = get_paths()?;
        code_tracker::delete_tracked_project(
            &paths.code_tracker_legacy(),
            &paths.code_tracker_windsurf(),
            &dir_name,
        )
    }).await.map_err(|e| e.to_string())?
}

// ===== Chat History =====

#[tauri::command]
pub async fn get_chat_sessions() -> Result<Vec<chat_history::ChatSession>, String> {
    tokio::task::spawn_blocking(|| {
        let paths = get_paths()?;
        Ok(chat_history::get_chat_sessions(
            &paths.chat_state_dir(),
            &paths.cascade_dir(),
        ))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn parse_chat_content(file_path: String) -> Result<chat_history::ParsedChatContent, String> {
    tokio::task::spawn_blocking(move || {
        chat_history::parse_chat_content(std::path::Path::new(&file_path))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_chat_session(file_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        chat_history::delete_chat_session(std::path::Path::new(&file_path))
    }).await.map_err(|e| e.to_string())?
}

// ===== Cascade API (Encrypted Chat) =====

#[tauri::command]
pub async fn discover_cascade_server() -> Result<cascade_api::LanguageServerInfo, String> {
    tokio::task::spawn_blocking(|| {
        cascade_api::discover_language_server()
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_cascade_trajectories() -> Result<Vec<cascade_api::CascadeSummary>, String> {
    tokio::task::spawn_blocking(|| {
        let info = cascade_api::discover_language_server()?;
        cascade_api::get_all_trajectories(&info)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_cascade_detail(cascade_id: String) -> Result<cascade_api::CascadeDetail, String> {
    tokio::task::spawn_blocking(move || {
        let info = cascade_api::discover_language_server()?;
        cascade_api::get_trajectory_detail(&info, &cascade_id)
    }).await.map_err(|e| e.to_string())?
}

// ===== AI Rules =====

#[tauri::command]
pub async fn get_ai_rules_data() -> Result<ai_rules::AIRulesData, String> {
    tokio::task::spawn_blocking(|| {
        let paths = get_paths()?;
        Ok(ai_rules::get_ai_rules_data(
            &paths.global_rules(),
            &paths.mcp_config(),
            &paths.user_settings_pb(),
        ))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn save_global_rules(content: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let paths = get_paths()?;
        ai_rules::save_global_rules(&paths.global_rules(), &content)
    }).await.map_err(|e| e.to_string())?
}

// ===== Privacy =====

#[tauri::command]
pub async fn scan_privacy_risks() -> Result<Vec<privacy::RiskItem>, String> {
    tokio::task::spawn_blocking(|| {
        let paths = get_paths()?;
        Ok(privacy::scan_privacy_risks(&paths))
    }).await.map_err(|e| e.to_string())?
}

// ===== Cleanup =====

#[tauri::command]
pub async fn get_cleanup_items() -> Result<Vec<cleanup::CleanupItem>, String> {
    tokio::task::spawn_blocking(|| {
        let paths = get_paths()?;
        Ok(cleanup::get_cleanup_items(&paths))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn execute_cleanup(keys: Vec<String>) -> Result<Vec<cleanup::CleanupResult>, String> {
    tokio::task::spawn_blocking(move || {
        let paths = get_paths()?;
        Ok(cleanup::execute_cleanup(&paths, &keys))
    }).await.map_err(|e| e.to_string())?
}

// ===== Focus =====

#[tauri::command]
pub fn focus_windsurf() -> Result<(), String> {
    focus::focus_windsurf()
}
