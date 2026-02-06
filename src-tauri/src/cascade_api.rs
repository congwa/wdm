use serde::Serialize;
use std::process::Command;

// ============================================================
// Types
// ============================================================

#[derive(Debug, Clone, Serialize)]
pub struct LanguageServerInfo {
    pub port: u16,
    pub csrf_token: String,
    pub pid: u32,
    pub workspace_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CascadeSummary {
    pub cascade_id: String,
    pub summary: String,
    pub step_count: u32,
    pub created_time: String,
    pub last_modified_time: String,
    pub status: String,
    pub errored: bool,
    pub model: String,
    pub workspace_names: Vec<String>,
    pub referenced_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CascadeStep {
    pub step_type: String,
    pub status: String,
    pub created_at: String,
    pub content: String,
    pub tool_name: Option<String>,
    pub file_uri: Option<String>,
    pub command: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CascadeDetail {
    pub cascade_id: String,
    pub trajectory_id: String,
    pub steps: Vec<CascadeStep>,
    pub raw_size: usize,
}

// ============================================================
// Language Server Discovery
// ============================================================

pub fn discover_language_server() -> Result<LanguageServerInfo, String> {
    // Find language_server_macos process (matches language_server_macos_x64 etc.)
    let output = Command::new("pgrep")
        .args(["-f", "language_server_macos"])
        .output()
        .map_err(|e| format!("pgrep failed: {}", e))?;

    let pids_str = String::from_utf8_lossy(&output.stdout);
    let pids: Vec<&str> = pids_str.lines().collect();

    if pids.is_empty() {
        return Err("Windsurf language server is not running. Please open Windsurf first.".to_string());
    }

    // Get command line args for each PID to find port and CSRF token
    for pid_str in &pids {
        let pid_str = pid_str.trim();
        if pid_str.is_empty() {
            continue;
        }

        let ps_output = Command::new("ps")
            .args(["-eww", "-p", pid_str, "-o", "args="])
            .output()
            .map_err(|e| format!("ps failed: {}", e))?;

        let args = String::from_utf8_lossy(&ps_output.stdout).to_string();

        // Must contain --run_child (this is the actual server process, not the manager)
        if !args.contains("--run_child") {
            continue;
        }

        let csrf = extract_arg(&args, "--csrf_token");
        if csrf.is_none() {
            continue;
        }
        let csrf_token = csrf.unwrap();
        let workspace_id = extract_arg(&args, "--workspace_id").unwrap_or_default();
        let pid: u32 = pid_str.parse().unwrap_or(0);

        // Strategy 1: explicit --server_port
        if let Some(port_str) = extract_arg(&args, "--server_port") {
            if let Ok(port) = port_str.parse::<u16>() {
                return Ok(LanguageServerInfo { port, csrf_token, pid, workspace_id });
            }
        }

        // Strategy 2: --random_port → discover via lsof
        if args.contains("--random_port") {
            let ports = discover_listening_ports(pid_str);
            // Try each port to find the one that responds to gRPC
            for port in ports {
                if probe_grpc_port(port, &csrf_token) {
                    return Ok(LanguageServerInfo { port, csrf_token, pid, workspace_id });
                }
            }
            // If probe failed, try the first port as fallback
            let fallback_ports = discover_listening_ports(pid_str);
            if let Some(&port) = fallback_ports.first() {
                return Ok(LanguageServerInfo { port, csrf_token, pid, workspace_id });
            }
        }
    }

    Err("Found language server process but could not extract port. Ensure Windsurf has an open workspace.".to_string())
}

/// Use lsof to discover which TCP ports a process is listening on
fn discover_listening_ports(pid: &str) -> Vec<u16> {
    let output = Command::new("lsof")
        .args(["-i", "TCP", "-P", "-n", "-p", pid, "-sTCP:LISTEN"])
        .output();

    let output = match output {
        Ok(o) => o,
        Err(_) => return Vec::new(),
    };

    let text = String::from_utf8_lossy(&output.stdout);
    let mut ports: Vec<u16> = Vec::new();

    for line in text.lines().skip(1) {
        // lsof output format: ... TCP 127.0.0.1:55769 (LISTEN)
        // Find the port number after the last colon
        let parts: Vec<&str> = line.split_whitespace().collect();
        for part in &parts {
            if part.contains("LISTEN") {
                continue;
            }
            if let Some(colon_pos) = part.rfind(':') {
                if let Ok(port) = part[colon_pos + 1..].parse::<u16>() {
                    if !ports.contains(&port) {
                        ports.push(port);
                    }
                }
            }
        }
    }

    ports
}

/// Quick probe to check if a port responds to our gRPC-style request
fn probe_grpc_port(port: u16, csrf_token: &str) -> bool {
    let url = format!(
        "http://127.0.0.1:{}/exa.language_server_pb.LanguageServerService/GetUserSettings",
        port
    );

    let client = match reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };

    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("x-codeium-csrf-token", csrf_token)
        .body("{}")
        .send();

    match resp {
        Ok(r) => {
            if !r.status().is_success() {
                return false;
            }
            // Verify the response is actually JSON with userSettings
            if let Ok(text) = r.text() {
                text.contains("userSettings")
            } else {
                false
            }
        }
        Err(_) => false,
    }
}

fn extract_arg(args: &str, flag: &str) -> Option<String> {
    let parts: Vec<&str> = args.split_whitespace().collect();
    for i in 0..parts.len().saturating_sub(1) {
        if parts[i] == flag {
            return Some(parts[i + 1].to_string());
        }
    }
    None
}

// ============================================================
// gRPC API Calls (via ConnectRPC/HTTP)
// ============================================================

pub fn get_all_trajectories(info: &LanguageServerInfo) -> Result<Vec<CascadeSummary>, String> {
    let url = format!(
        "http://127.0.0.1:{}/exa.language_server_pb.LanguageServerService/GetAllCascadeTrajectories",
        info.port
    );

    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("x-codeium-csrf-token", &info.csrf_token)
        .body("{}")
        .send()
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let status = resp.status();
    let body = resp.text().map_err(|e| format!("Read body failed: {}", e))?;

    if !status.is_success() {
        return Err(format!("API returned {}: {}", status, body));
    }

    // Parse the JSON response
    let parsed: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| format!("JSON parse failed: {}", e))?;

    let summaries = parsed
        .get("trajectorySummaries")
        .and_then(|v| v.as_object())
        .map(|obj| {
            obj.iter()
                .map(|(cascade_id, info_val)| {
                    let workspaces: Vec<String> = info_val
                        .get("workspaces")
                        .and_then(|w| w.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|ws| {
                                    ws.get("workspaceFolderAbsoluteUri")
                                        .and_then(|u| u.as_str())
                                        .map(|uri| {
                                            uri.split('/').last().unwrap_or("unknown").to_string()
                                        })
                                })
                                .collect()
                        })
                        .unwrap_or_default();

                    let refs: Vec<String> = info_val
                        .get("referencedContextItems")
                        .and_then(|r| r.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|item| {
                                    item.get("file")
                                        .and_then(|f| f.get("absoluteUri"))
                                        .and_then(|u| u.as_str())
                                        .map(|uri| {
                                            uri.split('/').last().unwrap_or("").to_string()
                                        })
                                })
                                .collect()
                        })
                        .unwrap_or_default();

                    CascadeSummary {
                        cascade_id: cascade_id.clone(),
                        summary: str_field(info_val, "summary"),
                        step_count: info_val
                            .get("stepCount")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0) as u32,
                        created_time: str_field(info_val, "createdTime"),
                        last_modified_time: str_field(info_val, "lastModifiedTime"),
                        status: str_field(info_val, "status"),
                        errored: info_val
                            .get("errored")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false),
                        model: str_field(info_val, "lastGeneratorModelUid"),
                        workspace_names: workspaces,
                        referenced_files: refs,
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(summaries)
}

pub fn get_trajectory_detail(
    info: &LanguageServerInfo,
    cascade_id: &str,
) -> Result<CascadeDetail, String> {
    let url = format!(
        "http://127.0.0.1:{}/exa.language_server_pb.LanguageServerService/GetCascadeTrajectory",
        info.port
    );

    let body = serde_json::json!({ "cascadeId": cascade_id }).to_string();

    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("x-codeium-csrf-token", &info.csrf_token)
        .body(body)
        .send()
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let status = resp.status();
    let raw = resp.text().map_err(|e| format!("Read body failed: {}", e))?;
    let raw_size = raw.len();

    if !status.is_success() {
        return Err(format!("API returned {}: {}", status, raw));
    }

    // The JSON may contain control characters and invalid escapes from code content.
    // We use regex to sanitize before parsing.
    let sanitized = sanitize_json(&raw);

    let parsed: serde_json::Value =
        serde_json::from_str(&sanitized).map_err(|e| format!("JSON parse failed: {}", e))?;

    let trajectory = parsed
        .get("trajectory")
        .ok_or("Missing trajectory field")?;

    let trajectory_id = str_field(trajectory, "trajectoryId");
    let steps_arr = trajectory
        .get("steps")
        .and_then(|s| s.as_array())
        .cloned()
        .unwrap_or_default();

    let steps: Vec<CascadeStep> = steps_arr
        .iter()
        .filter_map(|step| {
            let step_type = str_field(step, "type");
            let status = str_field(step, "status");
            let created_at = step
                .get("metadata")
                .and_then(|m| m.get("createdAt"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let (content, tool_name, file_uri, command) = extract_step_content(step, &step_type);

            // Skip empty system steps
            if content.is_empty()
                && tool_name.is_none()
                && file_uri.is_none()
                && command.is_none()
                && !matches!(
                    step_type.as_str(),
                    "CORTEX_STEP_TYPE_USER_INPUT" | "CORTEX_STEP_TYPE_PLANNER_RESPONSE"
                )
            {
                return None;
            }

            Some(CascadeStep {
                step_type,
                status,
                created_at,
                content,
                tool_name,
                file_uri,
                command,
            })
        })
        .collect();

    Ok(CascadeDetail {
        cascade_id: cascade_id.to_string(),
        trajectory_id,
        steps,
        raw_size,
    })
}

fn extract_step_content(
    step: &serde_json::Value,
    step_type: &str,
) -> (String, Option<String>, Option<String>, Option<String>) {
    match step_type {
        "CORTEX_STEP_TYPE_USER_INPUT" => {
            let text = step
                .get("userInput")
                .and_then(|ui| ui.get("text"))
                .or_else(|| step.get("userInput").and_then(|ui| ui.get("userResponse")))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            (text, None, None, None)
        }
        "CORTEX_STEP_TYPE_PLANNER_RESPONSE" => {
            let response = step
                .get("plannerResponse")
                .and_then(|pr| {
                    pr.get("modifiedResponse")
                        .or_else(|| pr.get("response"))
                })
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            (response, None, None, None)
        }
        "CORTEX_STEP_TYPE_VIEW_FILE" | "CORTEX_STEP_TYPE_VIEW_CONTENT" => {
            let uri = step
                .get("viewFile")
                .or_else(|| step.get("viewContent"))
                .and_then(|vf| vf.get("absoluteUri").or_else(|| vf.get("uri")))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            (String::new(), None, Some(uri), None)
        }
        "CORTEX_STEP_TYPE_RUN_COMMAND" => {
            let cmd = step
                .get("runCommand")
                .and_then(|rc| rc.get("command").or_else(|| rc.get("commandLine")))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            (String::new(), None, None, Some(cmd))
        }
        "CORTEX_STEP_TYPE_MCP_TOOL" => {
            let tool = step
                .get("mcpTool")
                .and_then(|mt| mt.get("toolName"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            (String::new(), Some(tool), None, None)
        }
        "CORTEX_STEP_TYPE_WRITE_FILE" | "CORTEX_STEP_TYPE_EDIT_FILE" => {
            let uri = step
                .get("writeFile")
                .or_else(|| step.get("editFile"))
                .and_then(|wf| wf.get("absoluteUri").or_else(|| wf.get("uri")))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            (String::new(), None, Some(uri), None)
        }
        "CORTEX_STEP_TYPE_MEMORY" => {
            let content = step
                .get("memory")
                .and_then(|m| m.get("memory"))
                .and_then(|m| m.get("textMemory"))
                .and_then(|tm| tm.get("content"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            (content, None, None, None)
        }
        "CORTEX_STEP_TYPE_ERROR_MESSAGE" => {
            let text = step
                .get("errorMessage")
                .and_then(|em| em.get("text").or_else(|| em.get("message")))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            (text, None, None, None)
        }
        "CORTEX_STEP_TYPE_LIST_DIRECTORY" => {
            let uri = step
                .get("listDirectory")
                .and_then(|ld| ld.get("absoluteUri").or_else(|| ld.get("uri")))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            (String::new(), None, Some(uri), None)
        }
        _ => (String::new(), None, None, None),
    }
}

fn str_field(val: &serde_json::Value, key: &str) -> String {
    val.get(key)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

/// Sanitize JSON string that may contain control characters or invalid escape sequences
fn sanitize_json(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let len = chars.len();
    let mut in_string = false;
    let mut i = 0;

    while i < len {
        let c = chars[i];

        if c == '"' {
            // Check if this quote is escaped
            let mut backslash_count = 0;
            let mut j = i;
            while j > 0 && chars[j - 1] == '\\' {
                backslash_count += 1;
                j -= 1;
            }
            if backslash_count % 2 == 0 {
                in_string = !in_string;
            }
            result.push(c);
        } else if in_string {
            if c == '\\' && i + 1 < len {
                let next = chars[i + 1];
                match next {
                    '"' | '\\' | '/' | 'b' | 'f' | 'n' | 'r' | 't' => {
                        result.push(c);
                        result.push(next);
                        i += 2;
                        continue;
                    }
                    'u' => {
                        // Unicode escape - pass through
                        result.push(c);
                    }
                    _ => {
                        // Invalid escape - double the backslash
                        result.push('\\');
                        result.push('\\');
                        result.push(next);
                        i += 2;
                        continue;
                    }
                }
            } else if (c as u32) < 0x20 {
                // Control character inside string
                match c {
                    '\n' => result.push_str("\\n"),
                    '\r' => result.push_str("\\r"),
                    '\t' => result.push_str("\\t"),
                    _ => result.push(' '),
                }
            } else {
                result.push(c);
            }
        } else {
            result.push(c);
        }

        i += 1;
    }

    result
}
