use rusqlite::Connection;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct EmbeddingStats {
    pub file_count: u64,
    pub versioned_file_count: u64,
    pub context_item_count: u64,
    pub snippet_count: u64,
    pub embedding_count: u64,
    pub commit_count: u64,
    pub commit_intent_count: u64,
    pub db_size: u64,
    pub free_pages: u64,
    pub total_pages: u64,
    pub page_size: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct IndexedFile {
    pub absolute_path: String,
    pub last_access_time: String,
    pub corpus_name: String,
    pub corpus_relative_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectSummary {
    pub corpus_name: String,
    pub file_count: u64,
    pub commit_count: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct IndexedCommit {
    pub repo_name: String,
    pub hexsha: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ContextItem {
    pub id: u64,
    pub node_uri: String,
    pub node_name: String,
    pub code_context_type: String,
    pub versioned_file_id: u64,
}

fn open_readonly(path: &Path) -> Result<Connection, String> {
    Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("Failed to open database: {}", e))
}

pub fn get_stats(db_path: &Path) -> Result<EmbeddingStats, String> {
    let conn = open_readonly(db_path)?;
    let db_size = db_path.metadata().map(|m| m.len()).unwrap_or(0);

    let count = |table: &str| -> u64 {
        conn.query_row(&format!("SELECT COUNT(*) FROM {}", table), [], |r| r.get(0))
            .unwrap_or(0)
    };

    let free_pages: u64 = conn.query_row("PRAGMA freelist_count", [], |r| r.get(0)).unwrap_or(0);
    let total_pages: u64 = conn.query_row("PRAGMA page_count", [], |r| r.get(0)).unwrap_or(0);
    let page_size: u64 = conn.query_row("PRAGMA page_size", [], |r| r.get(0)).unwrap_or(4096);

    Ok(EmbeddingStats {
        file_count: count("file_handles"),
        versioned_file_count: count("versioned_files"),
        context_item_count: count("code_context_items"),
        snippet_count: count("snippets"),
        embedding_count: count("embeddings"),
        commit_count: count("commits"),
        commit_intent_count: count("commit_intents"),
        db_size,
        free_pages,
        total_pages,
        page_size,
    })
}

pub fn get_files(db_path: &Path, limit: u32, offset: u32, search: &str) -> Result<Vec<IndexedFile>, String> {
    let conn = open_readonly(db_path)?;

    let sql = if search.is_empty() {
        format!(
            "SELECT fh.absolute_path, fh.last_access_time, vf.corpus_name, vf.corpus_relative_path \
             FROM file_handles fh \
             LEFT JOIN versioned_files vf ON fh.absolute_path LIKE '%' || vf.corpus_relative_path \
             ORDER BY fh.last_access_time DESC \
             LIMIT {} OFFSET {}",
            limit, offset
        )
    } else {
        format!(
            "SELECT fh.absolute_path, fh.last_access_time, vf.corpus_name, vf.corpus_relative_path \
             FROM file_handles fh \
             LEFT JOIN versioned_files vf ON fh.absolute_path LIKE '%' || vf.corpus_relative_path \
             WHERE fh.absolute_path LIKE '%{}%' \
             ORDER BY fh.last_access_time DESC \
             LIMIT {} OFFSET {}",
            search.replace('\'', "''"),
            limit,
            offset
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(IndexedFile {
                absolute_path: row.get::<_, String>(0).unwrap_or_default(),
                last_access_time: row.get::<_, String>(1).unwrap_or_default(),
                corpus_name: row.get::<_, String>(2).unwrap_or_default(),
                corpus_relative_path: row.get::<_, String>(3).unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn get_projects(db_path: &Path) -> Result<Vec<ProjectSummary>, String> {
    let conn = open_readonly(db_path)?;

    let mut stmt = conn
        .prepare(
            "SELECT corpus_name, COUNT(*) as file_count \
             FROM versioned_files \
             GROUP BY corpus_name \
             ORDER BY file_count DESC",
        )
        .map_err(|e| e.to_string())?;

    let projects: Vec<_> = stmt
        .query_map([], |row| {
            let corpus_name: String = row.get(0)?;
            let file_count: u64 = row.get(1)?;
            Ok((corpus_name, file_count))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Get commit counts per project
    let mut result = Vec::new();
    for (corpus_name, file_count) in projects {
        let commit_count: u64 = conn
            .query_row(
                "SELECT COUNT(*) FROM commits WHERE repo_name LIKE ?1",
                [format!("%{}%", corpus_name)],
                |r| r.get(0),
            )
            .unwrap_or(0);

        result.push(ProjectSummary {
            corpus_name,
            file_count,
            commit_count,
        });
    }

    Ok(result)
}

pub fn get_commits(db_path: &Path, limit: u32) -> Result<Vec<IndexedCommit>, String> {
    let conn = open_readonly(db_path)?;
    let mut stmt = conn
        .prepare(&format!(
            "SELECT repo_name, hexsha, message FROM commits ORDER BY rowid DESC LIMIT {}",
            limit
        ))
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(IndexedCommit {
                repo_name: row.get(0).unwrap_or_default(),
                hexsha: row.get(1).unwrap_or_default(),
                message: row.get(2).unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn get_context_items(db_path: &Path, limit: u32, offset: u32) -> Result<Vec<ContextItem>, String> {
    let conn = open_readonly(db_path)?;
    let mut stmt = conn
        .prepare(&format!(
            "SELECT id, node_uri, node_name, code_context_type, versioned_file_id \
             FROM code_context_items \
             ORDER BY id DESC LIMIT {} OFFSET {}",
            limit, offset
        ))
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ContextItem {
                id: row.get(0).unwrap_or(0),
                node_uri: row.get(1).unwrap_or_default(),
                node_name: row.get(2).unwrap_or_default(),
                code_context_type: row.get(3).unwrap_or_default(),
                versioned_file_id: row.get(4).unwrap_or(0),
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn vacuum_database(db_path: &Path) -> Result<u64, String> {
    let size_before = db_path.metadata().map(|m| m.len()).unwrap_or(0);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute_batch("VACUUM").map_err(|e| e.to_string())?;
    let size_after = db_path.metadata().map(|m| m.len()).unwrap_or(0);
    Ok(size_before.saturating_sub(size_after))
}

pub fn delete_project_index(db_path: &Path, corpus_name: &str) -> Result<u64, String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    // Get versioned_file_ids for this project
    let mut stmt = conn
        .prepare("SELECT id FROM versioned_files WHERE corpus_name = ?1")
        .map_err(|e| e.to_string())?;
    let ids: Vec<u64> = stmt
        .query_map([corpus_name], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    if ids.is_empty() {
        return Ok(0);
    }

    let id_list = ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");
    let mut total_deleted: u64 = 0;

    // Delete related data
    let tables = [
        format!("DELETE FROM embeddings WHERE snippet_id IN (SELECT id FROM snippets WHERE code_context_item_id IN (SELECT id FROM code_context_items WHERE versioned_file_id IN ({})))", id_list),
        format!("DELETE FROM snippets WHERE code_context_item_id IN (SELECT id FROM code_context_items WHERE versioned_file_id IN ({}))", id_list),
        format!("DELETE FROM code_context_items WHERE versioned_file_id IN ({})", id_list),
        format!("DELETE FROM versioned_files WHERE corpus_name = '{}'", corpus_name.replace('\'', "''")),
    ];

    for sql in &tables {
        let count = conn.execute(sql, []).map_err(|e| e.to_string())? as u64;
        total_deleted += count;
    }

    Ok(total_deleted)
}
