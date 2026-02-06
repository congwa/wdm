use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct McpServer {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: std::collections::HashMap<String, String>,
    pub disabled: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct AIRulesData {
    pub global_rules: String,
    pub global_rules_path: String,
    pub mcp_servers: Vec<McpServer>,
    pub mcp_config_path: String,
    pub model_names: Vec<String>,
}

pub fn get_ai_rules_data(
    global_rules_path: &Path,
    mcp_config_path: &Path,
    user_settings_pb_path: &Path,
) -> AIRulesData {
    // Read global rules
    let global_rules = std::fs::read_to_string(global_rules_path).unwrap_or_default();

    // Read MCP config
    let mcp_servers = parse_mcp_config(mcp_config_path);

    // Extract model names from user_settings.pb using strings
    let model_names = extract_model_names(user_settings_pb_path);

    AIRulesData {
        global_rules,
        global_rules_path: global_rules_path.display().to_string(),
        mcp_servers,
        mcp_config_path: mcp_config_path.display().to_string(),
        model_names,
    }
}

fn parse_mcp_config(path: &Path) -> Vec<McpServer> {
    if !path.exists() {
        return Vec::new();
    }

    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let v: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let mut servers = Vec::new();

    if let Some(obj) = v["mcpServers"].as_object() {
        for (name, config) in obj {
            let command = config["command"].as_str().unwrap_or("").to_string();
            let args = config["args"]
                .as_array()
                .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();
            let env = config["env"]
                .as_object()
                .map(|o| {
                    o.iter()
                        .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                        .collect()
                })
                .unwrap_or_default();
            let disabled = config["disabled"].as_bool().unwrap_or(false);

            servers.push(McpServer {
                name: name.clone(),
                command,
                args,
                env,
                disabled,
            });
        }
    }

    servers
}

fn extract_model_names(pb_path: &Path) -> Vec<String> {
    if !pb_path.exists() {
        return Vec::new();
    }

    let output = std::process::Command::new("strings")
        .arg(pb_path)
        .output();

    match output {
        Ok(out) => {
            let raw = String::from_utf8_lossy(&out.stdout);
            let known_providers = ["claude", "gpt", "gemini", "swe", "windsurf", "o1", "o3"];
            raw.lines()
                .filter(|line| {
                    let lower = line.to_lowercase();
                    known_providers.iter().any(|p| lower.contains(p))
                        && line.len() > 3
                        && line.len() < 80
                        && !line.contains('/')
                        && !line.contains('{')
                })
                .map(String::from)
                .collect::<Vec<_>>()
                .into_iter()
                .collect::<std::collections::HashSet<_>>()
                .into_iter()
                .collect()
        }
        Err(_) => Vec::new(),
    }
}

pub fn save_global_rules(path: &Path, content: &str) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(path, content).map_err(|e| format!("Failed to save: {}", e))
}
