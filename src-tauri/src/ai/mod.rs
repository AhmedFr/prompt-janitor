//! AI provider seam. Phase 4 ships the BYO-key providers (Anthropic / OpenAI);
//! a local SLM (Ollama) can slot in behind [`complete`] later.
//!
//! The API key is stored in settings and never returned to the frontend.

mod anthropic;
mod openai;
mod openrouter;
pub mod provider;

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
    provider::provider_for(provider)
        .map(|p| p.default_model())
        .unwrap_or("claude-sonnet-4-6")
        .to_string()
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

pub(crate) async fn complete(
    creds: &AiCredentials,
    system: &str,
    user: &str,
) -> Result<String, String> {
    if creds.key.is_empty() {
        return Err("No API key configured. Add one in Settings → AI.".to_string());
    }
    match provider::provider_for(&creds.provider) {
        Some(p) => p.complete(creds, system, user).await,
        None => Err("No AI provider selected.".to_string()),
    }
}
