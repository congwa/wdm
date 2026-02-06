use rusqlite::Connection;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceInfo {
    pub id: String,
    pub folder_uri: String,
    pub folder_name: String,
    pub path_exists: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct RecentPath {
    pub path_type: String, // "folder" or "file"
    pub uri: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceData {
    pub workspaces: Vec<WorkspaceInfo>,
    pub recent_paths: Vec<RecentPath>,
    pub terminal_commands: Vec<String>,
}

pub fn get_workspace_data(
    workspace_storage_dir: &Path,
    state_vscdb_path: &Path,
) -> Result<WorkspaceData, String> {
    let mut workspaces = Vec::new();

    // Scan workspace storage directories
    if workspace_storage_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(workspace_storage_dir) {
            for entry in entries.flatten() {
                let ws_dir = entry.path();
                let workspace_json = ws_dir.join("workspace.json");
                if workspace_json.exists() {
                    if let Ok(content) = std::fs::read_to_string(&workspace_json) {
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                            let folder = v["folder"].as_str().unwrap_or("");
                            let folder_path = folder
                                .strip_prefix("file://")
                                .unwrap_or(folder);
                            let folder_name = Path::new(folder_path)
                                .file_name()
                                .map(|n| n.to_string_lossy().to_string())
                                .unwrap_or_default();

                            workspaces.push(WorkspaceInfo {
                                id: ws_dir
                                    .file_name()
                                    .map(|n| n.to_string_lossy().to_string())
                                    .unwrap_or_default(),
                                folder_uri: folder.to_string(),
                                folder_name,
                                path_exists: Path::new(folder_path).exists(),
                            });
                        }
                    }
                }
            }
        }
    }

    // Read recent paths and terminal commands from state.vscdb
    let (recent_paths, terminal_commands) = if state_vscdb_path.exists() {
        let conn = Connection::open_with_flags(
            state_vscdb_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )
        .map_err(|e| e.to_string())?;

        let recents = parse_recent_paths(&conn);
        let cmds = parse_terminal_commands(&conn);
        (recents, cmds)
    } else {
        (Vec::new(), Vec::new())
    };

    Ok(WorkspaceData {
        workspaces,
        recent_paths,
        terminal_commands,
    })
}

fn parse_recent_paths(conn: &Connection) -> Vec<RecentPath> {
    let json_str: String = conn
        .query_row(
            "SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'",
            [],
            |r| r.get(0),
        )
        .unwrap_or_default();

    if json_str.is_empty() {
        return Vec::new();
    }

    let v: serde_json::Value = match serde_json::from_str(&json_str) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let mut result = Vec::new();
    if let Some(entries) = v["entries"].as_array() {
        for entry in entries.iter().take(20) {
            if let Some(folder) = entry["folderUri"].as_str() {
                let label = entry["label"].as_str().unwrap_or(folder);
                result.push(RecentPath {
                    path_type: "folder".to_string(),
                    uri: folder.to_string(),
                    label: label.to_string(),
                });
            } else if let Some(file) = entry["fileUri"].as_str() {
                let label = entry["label"].as_str().unwrap_or(file);
                result.push(RecentPath {
                    path_type: "file".to_string(),
                    uri: file.to_string(),
                    label: label.to_string(),
                });
            }
        }
    }

    result
}

fn parse_terminal_commands(conn: &Connection) -> Vec<String> {
    let json_str: String = conn
        .query_row(
            "SELECT value FROM ItemTable WHERE key = 'terminal.history.entries.commands'",
            [],
            |r| r.get(0),
        )
        .unwrap_or_default();

    if json_str.is_empty() {
        return Vec::new();
    }

    serde_json::from_str::<Vec<String>>(&json_str).unwrap_or_default()
}
