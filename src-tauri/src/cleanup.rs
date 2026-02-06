use serde::Serialize;
use std::path::Path;

use crate::paths::WindsurfPaths;
use crate::scanner::dir_size;

#[derive(Debug, Clone, Serialize)]
pub struct CleanupItem {
    pub key: String,
    pub label: String,
    pub size: u64,
    pub risk_level: String, // "safe", "warning", "danger"
    pub description: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CleanupResult {
    pub key: String,
    pub freed_size: u64,
    pub success: bool,
    pub error: Option<String>,
}

pub fn get_cleanup_items(paths: &WindsurfPaths) -> Vec<CleanupItem> {
    let mut items = Vec::new();

    // Safe items (auto-rebuild)
    let cache_path = paths.app_support.join("Cache");
    items.push(CleanupItem {
        key: "cache".into(),
        label: "浏览器缓存 (Cache/)".into(),
        size: dir_size(&cache_path),
        risk_level: "safe".into(),
        description: "Chromium 缓存，自动重建".into(),
        path: cache_path.display().to_string(),
    });

    let cached_data_path = paths.app_support.join("CachedData");
    items.push(CleanupItem {
        key: "cachedData".into(),
        label: "字节码缓存 (CachedData/)".into(),
        size: dir_size(&cached_data_path),
        risk_level: "safe".into(),
        description: "V8 字节码缓存，自动重建".into(),
        path: cached_data_path.display().to_string(),
    });

    let gpu_path = paths.app_support.join("GPUCache");
    let dawn_path = paths.app_support.join("DawnCache");
    items.push(CleanupItem {
        key: "gpu".into(),
        label: "GPU 缓存".into(),
        size: dir_size(&gpu_path) + dir_size(&dawn_path),
        risk_level: "safe".into(),
        description: "GPUCache/ + DawnCache/，自动重建".into(),
        path: gpu_path.display().to_string(),
    });

    let logs_path = paths.logs_dir();
    items.push(CleanupItem {
        key: "logs".into(),
        label: "日志文件 (logs/)".into(),
        size: dir_size(&logs_path),
        risk_level: "safe".into(),
        description: "编辑器日志文件".into(),
        path: logs_path.display().to_string(),
    });

    // VACUUM
    if let Some(db_path) = paths.embedding_db() {
        let db_size = db_path.metadata().map(|m| m.len()).unwrap_or(0);
        if let Ok(conn) = rusqlite::Connection::open_with_flags(
            &db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        ) {
            let free_pages: u64 = conn.query_row("PRAGMA freelist_count", [], |r| r.get(0)).unwrap_or(0);
            let total_pages: u64 = conn.query_row("PRAGMA page_count", [], |r| r.get(0)).unwrap_or(0);
            let page_size: u64 = conn.query_row("PRAGMA page_size", [], |r| r.get(0)).unwrap_or(4096);
            let reclaimable = free_pages * page_size;
            let pct = if total_pages > 0 { (free_pages * 100) / total_pages } else { 0 };

            items.push(CleanupItem {
                key: "vacuum".into(),
                label: "嵌入数据库压缩 (VACUUM)".into(),
                size: reclaimable,
                risk_level: "safe".into(),
                description: format!(
                    "{} 空闲页 / {} 总页 ({}%)，数据库: {}",
                    free_pages, total_pages, pct,
                    crate::scanner::format_size(db_size)
                ),
                path: db_path.display().to_string(),
            });
        }
    }

    // Warning items (not recoverable)
    let legacy_tracker = paths.code_tracker_legacy();
    items.push(CleanupItem {
        key: "codeTracker".into(),
        label: "旧版代码追踪副本".into(),
        size: dir_size(&legacy_tracker),
        risk_level: "warning".into(),
        description: "codeium 旧版代码快照，不可恢复".into(),
        path: legacy_tracker.display().to_string(),
    });

    let chat_state = paths.chat_state_dir();
    items.push(CleanupItem {
        key: "chatState".into(),
        label: "旧版 Codeium 聊天记录".into(),
        size: dir_size(&chat_state),
        risk_level: "warning".into(),
        description: "旧版对话记录（未加密 Protobuf），不可恢复".into(),
        path: chat_state.display().to_string(),
    });

    let session_storage = paths.app_support.join("Session Storage");
    items.push(CleanupItem {
        key: "session".into(),
        label: "Session Storage".into(),
        size: dir_size(&session_storage),
        risk_level: "warning".into(),
        description: "会丢失当前会话状态".into(),
        path: session_storage.display().to_string(),
    });

    items
}

pub fn execute_cleanup(paths: &WindsurfPaths, keys: &[String]) -> Vec<CleanupResult> {
    let mut results = Vec::new();

    for key in keys {
        let result = match key.as_str() {
            "cache" => delete_dir_contents(&paths.app_support.join("Cache")),
            "cachedData" => delete_dir_contents(&paths.app_support.join("CachedData")),
            "gpu" => {
                let r1 = delete_dir_contents(&paths.app_support.join("GPUCache"));
                let r2 = delete_dir_contents(&paths.app_support.join("DawnCache"));
                match (r1, r2) {
                    (Ok(a), Ok(b)) => Ok(a + b),
                    (Err(e), _) | (_, Err(e)) => Err(e),
                }
            }
            "logs" => delete_dir_contents(&paths.logs_dir()),
            "vacuum" => {
                if let Some(db_path) = paths.embedding_db() {
                    crate::embedding::vacuum_database(&db_path)
                } else {
                    Err("Embedding database not found".into())
                }
            }
            "codeTracker" => delete_dir_contents(&paths.code_tracker_legacy()),
            "chatState" => delete_dir_contents(&paths.chat_state_dir()),
            "session" => delete_dir_contents(&paths.app_support.join("Session Storage")),
            _ => Err(format!("Unknown cleanup key: {}", key)),
        };

        results.push(match result {
            Ok(freed) => CleanupResult {
                key: key.clone(),
                freed_size: freed,
                success: true,
                error: None,
            },
            Err(e) => CleanupResult {
                key: key.clone(),
                freed_size: 0,
                success: false,
                error: Some(e),
            },
        });
    }

    results
}

fn delete_dir_contents(path: &Path) -> Result<u64, String> {
    if !path.exists() {
        return Ok(0);
    }
    let size = dir_size(path);

    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                let _ = std::fs::remove_dir_all(&p);
            } else {
                let _ = std::fs::remove_file(&p);
            }
        }
    }

    Ok(size)
}
