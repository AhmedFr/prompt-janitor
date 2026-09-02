//! AI provider seam. Phase 4 ships the BYO-key providers (Anthropic / OpenAI /
//! OpenRouter), each registered as an [`provider::LlmProvider`] behind
//! `provider.rs`; a local SLM (Ollama) can slot in behind [`complete`] later.
//!
//! The API key lives in the platform secret store (the macOS Keychain, one
//! entry per provider — see `crate::secrets`) and is never returned to the
//! frontend; only `provider` and `model` are settings rows.

mod anthropic;
mod openai;
mod openrouter;
pub mod provider;

use crate::query::get_setting;
use crate::secrets::{ai_key_name, SecretStore};

/// Public view of the AI config (no secret key).
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct AiConfig {
    /// A provider id from `provider::provider_ids()`, or "none".
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

/// The selected provider's credentials. The key is looked up under that
/// provider's own name, so another provider's key can never be sent by
/// mistake; a store error reads as "no key" (the caller reports that
/// as "add a key in Settings"), and is printed so it is not silent.
pub(crate) fn load_credentials(
    conn: &rusqlite::Connection,
    store: &dyn SecretStore,
) -> AiCredentials {
    let provider = get_setting(conn, "ai_provider")
        .ok()
        .flatten()
        .unwrap_or_else(|| "none".to_string());
    let key = if provider::provider_ids().contains(&provider.as_str()) {
        store
            .get(&ai_key_name(&provider))
            .unwrap_or_else(|e| {
                eprintln!("{e}");
                None
            })
            .unwrap_or_default()
    } else {
        String::new()
    };
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
pub fn config_view(conn: &rusqlite::Connection, store: &dyn SecretStore) -> AiConfig {
    let creds = load_credentials(conn, store);
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
    match provider::provider_for(&creds.provider) {
        Some(p) => p.complete(creds, system, user).await,
        None => Err("No AI provider selected.".to_string()),
    }
}
