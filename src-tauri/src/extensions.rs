use serde::Serialize;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize)]
pub struct ExtensionInfo {
    pub id: String,
    pub version: String,
    pub publisher: String,
    pub source: String,
    pub installed_at: u64,
    pub size: u64,
    pub disabled: bool,
    pub path: String,
}

pub fn get_extensions(
    extensions_json_path: &Path,
    extensions_dir: &Path,
    state_vscdb_path: &Path,
) -> Result<Vec<ExtensionInfo>, String> {
    let content = std::fs::read_to_string(extensions_json_path)
        .map_err(|e| format!("Cannot read extensions.json: {}", e))?;
    let arr: Vec<serde_json::Value> =
        serde_json::from_str(&content).map_err(|e| format!("Invalid JSON: {}", e))?;

    // Get disabled extensions from state.vscdb
    let disabled_ids = get_disabled_extensions(state_vscdb_path);

    let mut extensions = Vec::new();
    for item in &arr {
        let id_obj = &item["identifier"];
        let id = id_obj["id"].as_str().unwrap_or("").to_string();
        let metadata = &item["metadata"];

        let version = item["version"].as_str().unwrap_or("").to_string();
        let publisher = metadata["publisherDisplayName"]
            .as_str()
            .unwrap_or("")
            .to_string();
        let source = metadata["source"].as_str().unwrap_or("unknown").to_string();
        let installed_at = metadata["installedTimestamp"].as_u64().unwrap_or(0);

        // Calculate directory size
        let ext_dir_name = format!("{}-{}", id, version);
        let ext_path = extensions_dir.join(&ext_dir_name);
        let size = dir_size_quick(&ext_path);
        let disabled = disabled_ids.contains(&id);

        extensions.push(ExtensionInfo {
            id,
            version,
            publisher,
            source,
            installed_at,
            size,
            disabled,
            path: ext_path.display().to_string(),
        });
    }

    Ok(extensions)
}

fn dir_size_quick(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }
    WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter_map(|e| e.metadata().ok())
        .filter(|m| m.is_file())
        .map(|m| m.len())
        .sum()
}

fn get_disabled_extensions(state_path: &Path) -> Vec<String> {
    if !state_path.exists() {
        return Vec::new();
    }
    let conn = match rusqlite::Connection::open_with_flags(
        state_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    ) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let json_str: String = conn
        .query_row(
            "SELECT value FROM ItemTable WHERE key = 'extensionsIdentifiers/disabled'",
            [],
            |r| r.get(0),
        )
        .unwrap_or_default();

    if json_str.is_empty() {
        return Vec::new();
    }

    serde_json::from_str::<Vec<serde_json::Value>>(&json_str)
        .unwrap_or_default()
        .iter()
        .filter_map(|v| v["id"].as_str().map(String::from))
        .collect()
}
