use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct TrackedProject {
    pub name: String,
    pub source: String, // "legacy" or "windsurf"
    pub dir_name: String,
    pub files: Vec<String>,
    pub total_size: u64,
    pub sensitive_files: Vec<String>,
}

pub fn get_tracked_projects(legacy_dir: &Path, windsurf_dir: &Path) -> Vec<TrackedProject> {
    let mut projects = Vec::new();

    // Scan legacy code tracker
    scan_tracker_dir(legacy_dir, "legacy", &mut projects);
    // Scan windsurf code tracker
    scan_tracker_dir(windsurf_dir, "windsurf", &mut projects);

    projects
}

fn scan_tracker_dir(dir: &Path, source: &str, projects: &mut Vec<TrackedProject>) {
    if !dir.exists() {
        return;
    }

    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let dir_name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            // Parse project name (format: {project}_{commit_hash} or just {project})
            let name = dir_name
                .rsplit('_')
                .skip(1)
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect::<Vec<_>>()
                .join("_");
            let name = if name.is_empty() {
                dir_name.clone()
            } else {
                name
            };

            let mut files = Vec::new();
            let mut total_size = 0u64;
            let mut sensitive_files = Vec::new();

            let sensitive_patterns = [".env", "credentials", ".key", ".pem", "secret", "token"];

            for file_entry in walkdir::WalkDir::new(&path).max_depth(3) {
                if let Ok(fe) = file_entry {
                    if fe.path().is_file() {
                        let file_name = fe
                            .path()
                            .strip_prefix(&path)
                            .map(|p| p.display().to_string())
                            .unwrap_or_default();

                        if let Ok(meta) = fe.metadata() {
                            total_size += meta.len();
                        }

                        // Check for sensitive files
                        let lower = file_name.to_lowercase();
                        if sensitive_patterns.iter().any(|p| lower.contains(p)) {
                            sensitive_files.push(file_name.clone());
                        }

                        files.push(file_name);
                    }
                }
            }

            projects.push(TrackedProject {
                name,
                source: source.to_string(),
                dir_name,
                files,
                total_size,
                sensitive_files,
            });
        }
    }
}

pub fn delete_tracked_project(legacy_dir: &Path, windsurf_dir: &Path, dir_name: &str) -> Result<(), String> {
    let legacy_path = legacy_dir.join(dir_name);
    let windsurf_path = windsurf_dir.join(dir_name);

    if legacy_path.exists() {
        std::fs::remove_dir_all(&legacy_path)
            .map_err(|e| format!("Failed to delete {}: {}", legacy_path.display(), e))?;
    } else if windsurf_path.exists() {
        std::fs::remove_dir_all(&windsurf_path)
            .map_err(|e| format!("Failed to delete {}: {}", windsurf_path.display(), e))?;
    } else {
        return Err(format!("Directory not found: {}", dir_name));
    }

    Ok(())
}
