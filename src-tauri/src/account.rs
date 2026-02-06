use rusqlite::Connection;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct PlanInfo {
    pub name: String,
    pub start_timestamp: u64,
    pub end_timestamp: u64,
    pub messages: u64,
    pub used_messages: u64,
    pub flow_actions: u64,
    pub used_flow_actions: u64,
    pub flex_credits: f64,
    pub used_flex_credits: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModelInfo {
    pub name: String,
    pub id: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct IdentityInfo {
    pub machine_id: String,
    pub device_id: String,
    pub installation_id: String,
    pub first_session: String,
    pub last_session: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AccountData {
    pub plan: Option<PlanInfo>,
    pub models: Vec<ModelInfo>,
    pub api_key: String,
    pub api_server: String,
    pub identity: IdentityInfo,
}

fn get_state_value(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM ItemTable WHERE key = ?1",
        [key],
        |row| row.get::<_, String>(0),
    )
    .ok()
}

pub fn get_account_data(state_vscdb_path: &Path) -> Result<AccountData, String> {
    let conn = Connection::open_with_flags(
        state_vscdb_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .map_err(|e| format!("Cannot open state.vscdb: {}", e))?;

    // Plan info
    let plan = get_state_value(&conn, "windsurf.settings.cachedPlanInfo")
        .and_then(|v| parse_plan_info(&v));

    // Auth status → API key + models
    let auth_json = get_state_value(&conn, "windsurfAuthStatus").unwrap_or_default();
    let api_key = extract_api_key(&auth_json);

    // Models from windsurfConfigurations
    let config_json = get_state_value(&conn, "windsurfConfigurations").unwrap_or_default();
    let models = extract_models(&config_json);

    // API server
    let api_server = get_state_value(&conn, "secret://windsurf_auth.apiServerUrl")
        .unwrap_or_else(|| "server.codeium.com".to_string());

    // Identity
    let machine_id = get_state_value(&conn, "storage.serviceMachineId").unwrap_or_default();
    let device_id = get_state_value(&conn, "telemetry.devDeviceId").unwrap_or_default();
    let installation_id =
        get_state_value(&conn, "telemetry.sqmId").unwrap_or_default();
    let first_session = get_state_value(&conn, "telemetry.firstSessionDate").unwrap_or_default();
    let last_session = get_state_value(&conn, "telemetry.lastSessionDate").unwrap_or_default();

    Ok(AccountData {
        plan,
        models,
        api_key,
        api_server,
        identity: IdentityInfo {
            machine_id,
            device_id,
            installation_id,
            first_session,
            last_session,
        },
    })
}

fn parse_plan_info(json_str: &str) -> Option<PlanInfo> {
    let v: serde_json::Value = serde_json::from_str(json_str).ok()?;
    Some(PlanInfo {
        name: v["planName"].as_str().unwrap_or("Unknown").to_string(),
        start_timestamp: v["planStartTimestamp"].as_u64().unwrap_or(0),
        end_timestamp: v["planEndTimestamp"].as_u64().unwrap_or(0),
        messages: v["usageInfo"]["maxMessages"].as_u64().unwrap_or(0),
        used_messages: v["usageInfo"]["usedMessages"].as_u64().unwrap_or(0),
        flow_actions: v["usageInfo"]["maxFlowActions"].as_u64().unwrap_or(0),
        used_flow_actions: v["usageInfo"]["usedFlowActions"].as_u64().unwrap_or(0),
        flex_credits: v["usageInfo"]["flexCredits"].as_f64().unwrap_or(0.0),
        used_flex_credits: v["usageInfo"]["usedFlexCredits"].as_f64().unwrap_or(0.0),
    })
}

fn extract_api_key(auth_json: &str) -> String {
    if auth_json.is_empty() {
        return String::new();
    }
    let v: serde_json::Value = match serde_json::from_str(auth_json) {
        Ok(v) => v,
        Err(_) => return String::new(),
    };
    // Try common paths for API key
    v["api_key"]
        .as_str()
        .or_else(|| v["apiKey"].as_str())
        .or_else(|| {
            // Search in nested structures
            if let Some(arr) = v.as_array() {
                for item in arr {
                    if let Some(key) = item["api_key"].as_str().or_else(|| item["apiKey"].as_str()) {
                        return Some(key);
                    }
                }
            }
            None
        })
        .unwrap_or("")
        .to_string()
}

fn extract_models(config_json: &str) -> Vec<ModelInfo> {
    if config_json.is_empty() {
        return Vec::new();
    }
    let v: serde_json::Value = match serde_json::from_str(config_json) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let mut models = Vec::new();

    // Try to find models array in the configuration
    if let Some(arr) = v["chatModelConfigs"].as_array() {
        for item in arr {
            let name = item["modelName"]
                .as_str()
                .or_else(|| item["name"].as_str())
                .unwrap_or("Unknown");
            let id = item["model"]
                .as_str()
                .or_else(|| item["modelId"].as_str())
                .unwrap_or("");
            let provider = item["provider"]
                .as_str()
                .or_else(|| item["providerName"].as_str())
                .unwrap_or("Unknown");

            models.push(ModelInfo {
                name: name.to_string(),
                id: id.to_string(),
                provider: provider.to_string(),
            });
        }
    }

    // Fallback: try to extract model names from strings in user_settings
    if models.is_empty() {
        if let Some(obj) = v.as_object() {
            for (key, val) in obj {
                if key.contains("model") || key.contains("Model") {
                    if let Some(name) = val.as_str() {
                        models.push(ModelInfo {
                            name: name.to_string(),
                            id: String::new(),
                            provider: String::new(),
                        });
                    }
                }
            }
        }
    }

    models
}
