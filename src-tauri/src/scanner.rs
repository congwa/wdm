use serde::Serialize;
use std::path::Path;
use walkdir::WalkDir;

use crate::paths::WindsurfPaths;

#[derive(Debug, Clone, Serialize)]
pub struct DiskCategory {
    pub name: String,
    pub size: u64,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DashboardOverview {
    pub total_size: u64,
    pub categories: Vec<DiskCategory>,
    pub indexed_file_count: u64,
    pub context_item_count: u64,
    pub embedding_count: u64,
    pub commit_count: u64,
    pub tracked_project_count: u64,
    pub extension_count: u64,
    pub chat_session_count: u64,
    pub reclaimable_size: u64,
    pub db_free_pages: u64,
    pub db_total_pages: u64,
}

/// Format bytes to human-readable string
pub fn format_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    if bytes == 0 {
        return "0 B".to_string();
    }
    let k = 1024f64;
    let i = (bytes as f64).log(k).floor() as usize;
    let i = i.min(UNITS.len() - 1);
    let val = bytes as f64 / k.powi(i as i32);
    if val < 10.0 {
        format!("{:.1} {}", val, UNITS[i])
    } else {
        format!("{:.0} {}", val, UNITS[i])
    }
}

/// Get total size of a directory
pub fn dir_size(path: &Path) -> u64 {
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

/// Count files in a directory matching a pattern
pub fn count_files(path: &Path, ext: &str) -> u64 {
    if !path.exists() {
        return 0;
    }
    WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map_or(false, |x| x == ext))
        .count() as u64
}

/// Count subdirectories (depth 1) in a directory
pub fn count_subdirs(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }
    std::fs::read_dir(path)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| e.path().is_dir())
                .count() as u64
        })
        .unwrap_or(0)
}

/// Build full dashboard overview
pub fn scan_dashboard(paths: &WindsurfPaths) -> DashboardOverview {
    // Disk categories
    let embedding_db_path = paths.embedding_db();
    let embedding_size = embedding_db_path
        .as_ref()
        .map(|p| p.metadata().map(|m| m.len()).unwrap_or(0))
        .unwrap_or(0);
    let extensions_size = dir_size(&paths.windsurf_dot.join("extensions"));
    let cache_size = dir_size(&paths.app_support.join("Cache"))
        + dir_size(&paths.app_support.join("CachedData"))
        + dir_size(&paths.app_support.join("GPUCache"))
        + dir_size(&paths.app_support.join("DawnCache"));
    let user_data_size = dir_size(&paths.app_support.join("User"));
    let logs_size = dir_size(&paths.logs_dir());
    let code_tracker_size =
        dir_size(&paths.code_tracker_legacy()) + dir_size(&paths.code_tracker_windsurf());
    let chat_size = dir_size(&paths.chat_state_dir()) + dir_size(&paths.cascade_dir());
    let implicit_size = dir_size(&paths.codeium.join("implicit"))
        + dir_size(&paths.codeium_windsurf.join("implicit"));

    let other_size = user_data_size + logs_size + code_tracker_size + chat_size + implicit_size;

    let categories = vec![
        DiskCategory {
            name: "嵌入数据库".into(),
            size: embedding_size,
            path: embedding_db_path
                .as_ref()
                .map(|p| p.display().to_string())
                .unwrap_or_default(),
        },
        DiskCategory {
            name: "扩展".into(),
            size: extensions_size,
            path: paths.windsurf_dot.join("extensions").display().to_string(),
        },
        DiskCategory {
            name: "缓存".into(),
            size: cache_size,
            path: paths.app_support.join("Cache").display().to_string(),
        },
        DiskCategory {
            name: "用户数据".into(),
            size: other_size,
            path: paths.app_support.join("User").display().to_string(),
        },
    ];

    let total_size = categories.iter().map(|c| c.size).sum();

    // SQLite stats from embedding db
    let (indexed_file_count, context_item_count, embedding_count, commit_count, db_free_pages, db_total_pages) =
        embedding_db_path
            .as_ref()
            .and_then(|p| query_embedding_stats(p))
            .unwrap_or((0, 0, 0, 0, 0, 0));

    // Code tracker project count
    let tracked_legacy = count_subdirs(&paths.code_tracker_legacy());
    let tracked_windsurf = count_subdirs(&paths.code_tracker_windsurf());
    let tracked_project_count = tracked_legacy + tracked_windsurf;

    // Extension count
    let extension_count = count_extension_count(&paths.extensions_json());

    // Chat session count
    let legacy_chats = count_files(&paths.chat_state_dir(), "pb");
    let cascade_chats = count_files(&paths.cascade_dir(), "pb");
    let chat_session_count = legacy_chats + cascade_chats;

    // Reclaimable = cache + free pages in db
    let db_page_size = if db_total_pages > 0 {
        embedding_size / db_total_pages
    } else {
        4096
    };
    let reclaimable_size = cache_size + (db_free_pages * db_page_size);

    DashboardOverview {
        total_size,
        categories,
        indexed_file_count,
        context_item_count,
        embedding_count,
        commit_count,
        tracked_project_count,
        extension_count,
        chat_session_count,
        reclaimable_size,
        db_free_pages,
        db_total_pages,
    }
}

fn query_embedding_stats(db_path: &Path) -> Option<(u64, u64, u64, u64, u64, u64)> {
    let conn = rusqlite::Connection::open_with_flags(
        db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .ok()?;

    let file_count: u64 = conn
        .query_row("SELECT COUNT(*) FROM file_handles", [], |r| r.get(0))
        .unwrap_or(0);
    let context_count: u64 = conn
        .query_row("SELECT COUNT(*) FROM code_context_items", [], |r| r.get(0))
        .unwrap_or(0);
    let embedding_count: u64 = conn
        .query_row("SELECT COUNT(*) FROM embeddings", [], |r| r.get(0))
        .unwrap_or(0);
    let commit_count: u64 = conn
        .query_row("SELECT COUNT(*) FROM commits", [], |r| r.get(0))
        .unwrap_or(0);
    let free_pages: u64 = conn
        .query_row("PRAGMA freelist_count", [], |r| r.get(0))
        .unwrap_or(0);
    let total_pages: u64 = conn
        .query_row("PRAGMA page_count", [], |r| r.get(0))
        .unwrap_or(0);

    Some((
        file_count,
        context_count,
        embedding_count,
        commit_count,
        free_pages,
        total_pages,
    ))
}

fn count_extension_count(json_path: &Path) -> u64 {
    if !json_path.exists() {
        return 0;
    }
    std::fs::read_to_string(json_path)
        .ok()
        .and_then(|s| serde_json::from_str::<Vec<serde_json::Value>>(&s).ok())
        .map(|v| v.len() as u64)
        .unwrap_or(0)
}
