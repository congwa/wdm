use std::path::PathBuf;

/// Resolve all Windsurf data directories
pub struct WindsurfPaths {
    pub home: PathBuf,
    pub codeium: PathBuf,
    pub codeium_windsurf: PathBuf,
    pub app_support: PathBuf,
    pub windsurf_dot: PathBuf,
    pub cache: PathBuf,
}

impl WindsurfPaths {
    pub fn new() -> Option<Self> {
        let home = dirs::home_dir()?;
        Some(Self {
            codeium: home.join(".codeium"),
            codeium_windsurf: home.join(".codeium/windsurf"),
            app_support: home.join("Library/Application Support/Windsurf"),
            windsurf_dot: home.join(".windsurf"),
            cache: home.join("Library/Caches/com.exafunction.windsurf"),
            home,
        })
    }

    /// Find the embedding database path (search for the sqlite file recursively)
    pub fn embedding_db(&self) -> Option<PathBuf> {
        let db_base = self.codeium.join("database");
        if !db_base.exists() {
            return None;
        }
        // Walk to find embedding_database.sqlite
        for entry in walkdir::WalkDir::new(&db_base).max_depth(6) {
            if let Ok(e) = entry {
                if e.file_name() == "embedding_database.sqlite" {
                    return Some(e.path().to_path_buf());
                }
            }
        }
        None
    }

    /// state.vscdb path
    pub fn state_vscdb(&self) -> PathBuf {
        self.app_support.join("User/globalStorage/state.vscdb")
    }

    /// extensions.json
    pub fn extensions_json(&self) -> PathBuf {
        self.windsurf_dot.join("extensions/extensions.json")
    }

    /// global_rules.md
    pub fn global_rules(&self) -> PathBuf {
        self.codeium_windsurf.join("memories/global_rules.md")
    }

    /// mcp_config.json
    pub fn mcp_config(&self) -> PathBuf {
        self.codeium_windsurf.join("mcp_config.json")
    }

    /// chat_state directory (legacy, unencrypted)
    pub fn chat_state_dir(&self) -> PathBuf {
        self.codeium.join("chat_state")
    }

    /// cascade directory (new, encrypted)
    pub fn cascade_dir(&self) -> PathBuf {
        self.codeium_windsurf.join("cascade")
    }

    /// code_tracker directories
    pub fn code_tracker_legacy(&self) -> PathBuf {
        self.codeium.join("code_tracker/active")
    }

    pub fn code_tracker_windsurf(&self) -> PathBuf {
        self.codeium_windsurf.join("code_tracker/active")
    }

    /// workspace storage directory
    pub fn workspace_storage(&self) -> PathBuf {
        self.app_support.join("User/workspaceStorage")
    }

    /// logs directory
    pub fn logs_dir(&self) -> PathBuf {
        self.app_support.join("logs")
    }

    /// User settings directory
    pub fn user_settings_pb(&self) -> PathBuf {
        self.codeium_windsurf.join("user_settings.pb")
    }
}
