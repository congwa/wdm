use serde::Serialize;

use crate::paths::WindsurfPaths;

#[derive(Debug, Clone, Serialize)]
pub struct RiskItem {
    pub id: String,
    pub level: String, // "high", "medium", "low"
    pub title: String,
    pub location: String,
    pub preview: Option<String>,
}

pub fn scan_privacy_risks(paths: &WindsurfPaths) -> Vec<RiskItem> {
    let mut risks = Vec::new();
    let mut id_counter = 0u32;

    let mut next_id = || {
        id_counter += 1;
        format!("risk_{}", id_counter)
    };

    // 1. Check API Key in state.vscdb
    let state_path = paths.state_vscdb();
    if state_path.exists() {
        if let Ok(conn) = rusqlite::Connection::open_with_flags(
            &state_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        ) {
            // API Key check
            if let Ok(val) = conn.query_row(
                "SELECT value FROM ItemTable WHERE key = 'windsurfAuthStatus'",
                [],
                |r| r.get::<_, String>(0),
            ) {
                if val.contains("sk-") || val.contains("api_key") || val.contains("apiKey") {
                    let preview = if let Some(start) = val.find("sk-") {
                        let end = (start + 20).min(val.len());
                        Some(format!("{}...", &val[start..end]))
                    } else {
                        None
                    };
                    risks.push(RiskItem {
                        id: next_id(),
                        level: "high".into(),
                        title: "API Key 明文暴露".into(),
                        location: "state.vscdb → windsurfAuthStatus".into(),
                        preview,
                    });
                }
            }

            // WakaTime key reference
            if let Ok(val) = conn.query_row(
                "SELECT value FROM ItemTable WHERE key LIKE '%wakatime%'",
                [],
                |r| r.get::<_, String>(0),
            ) {
                if !val.is_empty() {
                    risks.push(RiskItem {
                        id: next_id(),
                        level: "high".into(),
                        title: "WakaTime API Key 引用".into(),
                        location: "state.vscdb → extensionKeys/wakatime".into(),
                        preview: None,
                    });
                }
            }

            // Device identifiers
            let id_keys = [
                ("storage.serviceMachineId", "机器 ID"),
                ("telemetry.devDeviceId", "设备 ID"),
                ("telemetry.sqmId", "安装 ID"),
            ];
            for (key, label) in &id_keys {
                if let Ok(val) = conn.query_row(
                    "SELECT value FROM ItemTable WHERE key = ?1",
                    [key],
                    |r| r.get::<_, String>(0),
                ) {
                    if !val.is_empty() {
                        risks.push(RiskItem {
                            id: next_id(),
                            level: "medium".into(),
                            title: format!("设备标识符: {}", label),
                            location: format!("state.vscdb → {}", key),
                            preview: Some(if val.len() > 24 {
                                format!("{}...", &val[..24])
                            } else {
                                val
                            }),
                        });
                    }
                }
            }

            // Terminal command history
            if let Ok(val) = conn.query_row(
                "SELECT value FROM ItemTable WHERE key = 'terminal.history.entries.commands'",
                [],
                |r| r.get::<_, String>(0),
            ) {
                if !val.is_empty() {
                    risks.push(RiskItem {
                        id: next_id(),
                        level: "low".into(),
                        title: "终端命令历史".into(),
                        location: "state.vscdb → terminal.history".into(),
                        preview: None,
                    });
                }
            }

            // Telemetry dates
            if let Ok(first) = conn.query_row(
                "SELECT value FROM ItemTable WHERE key = 'telemetry.firstSessionDate'",
                [],
                |r| r.get::<_, String>(0),
            ) {
                let last: String = conn
                    .query_row(
                        "SELECT value FROM ItemTable WHERE key = 'telemetry.lastSessionDate'",
                        [],
                        |r| r.get(0),
                    )
                    .unwrap_or_default();
                risks.push(RiskItem {
                    id: next_id(),
                    level: "low".into(),
                    title: "遥测会话日期".into(),
                    location: "state.vscdb → telemetry".into(),
                    preview: Some(format!("首次: {} 最近: {}", first, last)),
                });
            }
        }
    }

    // 2. Scan code tracker for sensitive files
    let sensitive_patterns = [".env", "credentials", ".key", ".pem", "secret", "token"];
    for tracker_dir in [&paths.code_tracker_legacy(), &paths.code_tracker_windsurf()] {
        if !tracker_dir.exists() {
            continue;
        }
        for entry in walkdir::WalkDir::new(tracker_dir).max_depth(4) {
            if let Ok(e) = entry {
                if e.path().is_file() {
                    let name = e.file_name().to_string_lossy().to_lowercase();
                    if sensitive_patterns.iter().any(|p| name.contains(p)) {
                        let rel = e.path().strip_prefix(tracker_dir)
                            .map(|p| p.display().to_string())
                            .unwrap_or_default();
                        risks.push(RiskItem {
                            id: next_id(),
                            level: "medium".into(),
                            title: format!("代码副本中的敏感文件: {}", e.file_name().to_string_lossy()),
                            location: format!("code_tracker → {}", rel),
                            preview: None,
                        });
                    }
                }
            }
        }
    }

    // 3. Cookies database
    let cookies_path = paths.app_support.join("Cookies");
    if cookies_path.exists() {
        let size = cookies_path.metadata().map(|m| m.len()).unwrap_or(0);
        if size > 0 {
            risks.push(RiskItem {
                id: next_id(),
                level: "low".into(),
                title: "Cookies 数据库".into(),
                location: format!("Application Support/Windsurf/Cookies ({}KB)", size / 1024),
                preview: None,
            });
        }
    }

    // 4. Network state
    let network_state = paths.app_support.join("Network Persistent State");
    if network_state.exists() {
        risks.push(RiskItem {
            id: next_id(),
            level: "low".into(),
            title: "网络连接记录".into(),
            location: "Network Persistent State".into(),
            preview: None,
        });
    }

    risks
}
