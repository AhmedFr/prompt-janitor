use serde_json::json;

use super::provider::{CompletionFuture, LlmProvider};
use super::AiCredentials;

pub struct Anthropic;

impl LlmProvider for Anthropic {
    fn id(&self) -> &'static str {
        "anthropic"
    }
    fn default_model(&self) -> &'static str {
        "claude-sonnet-4-6"
    }
    fn complete<'a>(
        &'a self,
        creds: &'a AiCredentials,
        system: &'a str,
        user: &'a str,
    ) -> CompletionFuture<'a> {
        Box::pin(async move {
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
        })
    }
}
