//! AI provider seam. Phase 4 ships the BYO-key providers (Anthropic / OpenAI);
//! a local SLM (Ollama) can slot in behind [`complete`] later.
//!
//! The API key is stored in settings and never returned to the frontend.

use serde_json::json;

use crate::query::get_setting;

/// Public view of the AI config (no secret key).
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct AiConfig {
    /// "anthropic", "openai", or "none".
    pub provider: String,
    pub model: String,
    /// Whether an API key is stored.
    pub has_key: bool,
}

/// Internal credentials (includes the key).
pub(crate) struct AiCredentials {
    pub provider: String,
    pub key: String,
    pub model: String,
}

fn default_model(provider: &str) -> String {
    match provider {
        "openai" => "gpt-4o-mini".to_string(),
        _ => "claude-sonnet-4-6".to_string(),
    }
}

pub(crate) fn load_credentials(conn: &rusqlite::Connection) -> AiCredentials {
    let provider = get_setting(conn, "ai_provider")
        .ok()
        .flatten()
        .unwrap_or_else(|| "none".to_string());
    let key = get_setting(conn, "ai_key")
        .ok()
        .flatten()
        .unwrap_or_default();
    let model = get_setting(conn, "ai_model")
        .ok()
        .flatten()
        .filter(|m| !m.is_empty())
        .unwrap_or_else(|| default_model(&provider));
    AiCredentials {
        provider,
        key,
        model,
    }
}

/// The config to show in Settings (no key).
pub fn config_view(conn: &rusqlite::Connection) -> AiConfig {
    let creds = load_credentials(conn);
    AiConfig {
        provider: creds.provider,
        model: creds.model,
        has_key: !creds.key.is_empty(),
    }
}

/// Run a single completion with the configured provider.
pub(crate) async fn complete(
    creds: &AiCredentials,
    system: &str,
    user: &str,
) -> Result<String, String> {
    if creds.key.is_empty() {
        return Err("No API key configured. Add one in Settings → AI.".to_string());
    }
    match creds.provider.as_str() {
        "anthropic" => anthropic(creds, system, user).await,
        "openai" => openai(creds, system, user).await,
        _ => Err("No AI provider selected.".to_string()),
    }
}

async fn anthropic(creds: &AiCredentials, system: &str, user: &str) -> Result<String, String> {
    let resp = reqwest::Client::new()
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &creds.key)
        .header("anthropic-version", "2023-06-01")
        .json(&json!({
            "model": creds.model,
            "max_tokens": 1024,
            "system": system,
            "messages": [{ "role": "user", "content": user }],
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Anthropic error {status}: {body}"));
    }
    let value: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(value["content"][0]["text"]
        .as_str()
        .unwrap_or_default()
        .to_string())
}

async fn openai(creds: &AiCredentials, system: &str, user: &str) -> Result<String, String> {
    let resp = reqwest::Client::new()
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(&creds.key)
        .json(&json!({
            "model": creds.model,
            "messages": [
                { "role": "system", "content": system },
                { "role": "user", "content": user },
            ],
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("OpenAI error {status}: {body}"));
    }
    let value: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(value["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or_default()
        .to_string())
}
