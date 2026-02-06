use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct ChatSession {
    pub id: String,
    pub file_name: String,
    pub file_path: String,
    pub project: String,
    pub size: u64,
    pub last_modified: String,
    pub encrypted: bool,
    pub source: String, // "legacy" or "cascade"
}

#[derive(Debug, Clone, Serialize)]
pub struct ParsedChatContent {
    pub related_files: Vec<String>,
    pub code_snippets: Vec<String>,
    pub raw_strings: Vec<String>,
}

pub fn get_chat_sessions(chat_state_dir: &Path, cascade_dir: &Path) -> Vec<ChatSession> {
    let mut sessions = Vec::new();

    // Legacy (unencrypted)
    scan_chat_dir(chat_state_dir, "legacy", false, &mut sessions);
    // Cascade (encrypted)
    scan_chat_dir(cascade_dir, "cascade", true, &mut sessions);

    sessions
}

fn scan_chat_dir(dir: &Path, source: &str, encrypted: bool, sessions: &mut Vec<ChatSession>) {
    if !dir.exists() {
        return;
    }

    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(true, |e| e != "pb") {
                continue;
            }

            let file_name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            let size = path.metadata().map(|m| m.len()).unwrap_or(0);
            let last_modified = path
                .metadata()
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| {
                    let secs = d.as_secs() as i64;
                    let days = secs / 86400;
                    let years = 1970 + (days * 400 / 146097);
                    let rem = days - ((years - 1970) * 365 + (years - 1970) / 4 - (years - 1970) / 100 + (years - 1970) / 400);
                    let months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
                    let mut m = 0;
                    let mut d_rem = rem;
                    for &ml in &months {
                        if d_rem < ml { break; }
                        d_rem -= ml;
                        m += 1;
                    }
                    format!("{:04}-{:02}-{:02}", years, m + 1, d_rem + 1)
                })
                .unwrap_or_default();

            // Extract project name from file name
            let project = file_name
                .trim_end_matches(".pb")
                .to_string();

            sessions.push(ChatSession {
                id: format!("{}_{}", source, project),
                file_name,
                file_path: path.display().to_string(),
                project,
                size,
                last_modified,
                encrypted,
                source: source.to_string(),
            });
        }
    }
}

pub fn parse_chat_content(file_path: &Path) -> Result<ParsedChatContent, String> {
    if !file_path.exists() {
        return Err("File not found".to_string());
    }

    // Use strings command to extract readable text from protobuf
    let output = Command::new("strings")
        .arg(file_path)
        .output()
        .map_err(|e| format!("Failed to run strings: {}", e))?;

    let raw = String::from_utf8_lossy(&output.stdout).to_string();
    let lines: Vec<&str> = raw.lines().collect();

    let mut related_files = Vec::new();
    let mut code_snippets = Vec::new();
    let mut raw_strings = Vec::new();

    for line in &lines {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.len() < 3 {
            continue;
        }

        // Detect file paths
        if trimmed.contains('.') && (
            trimmed.ends_with(".vue") || trimmed.ends_with(".ts") ||
            trimmed.ends_with(".tsx") || trimmed.ends_with(".js") ||
            trimmed.ends_with(".jsx") || trimmed.ends_with(".json") ||
            trimmed.ends_with(".css") || trimmed.ends_with(".html") ||
            trimmed.ends_with(".md") || trimmed.ends_with(".py") ||
            trimmed.ends_with(".rs") || trimmed.ends_with(".go")
        ) {
            if !related_files.contains(&trimmed.to_string()) && related_files.len() < 50 {
                related_files.push(trimmed.to_string());
            }
        }
        // Detect code snippets (lines with common code patterns)
        else if trimmed.contains("function ") || trimmed.contains("const ")
            || trimmed.contains("export ") || trimmed.contains("import ")
            || trimmed.contains("class ") || trimmed.contains("def ")
            || trimmed.starts_with("//") || trimmed.starts_with("/*")
        {
            if code_snippets.len() < 30 {
                code_snippets.push(trimmed.to_string());
            }
        }
        // Collect other meaningful strings
        else if trimmed.len() > 10 && raw_strings.len() < 100 {
            raw_strings.push(trimmed.to_string());
        }
    }

    Ok(ParsedChatContent {
        related_files,
        code_snippets,
        raw_strings,
    })
}

pub fn delete_chat_session(file_path: &Path) -> Result<(), String> {
    std::fs::remove_file(file_path)
        .map_err(|e| format!("Failed to delete: {}", e))
}
