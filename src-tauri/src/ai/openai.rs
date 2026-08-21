use serde_json::json;

use super::provider::{CompletionFuture, LlmProvider};
use super::AiCredentials;

pub struct OpenAi;

impl LlmProvider for OpenAi {
    fn id(&self) -> &'static str {
        "openai"
    }
    fn default_model(&self) -> &'static str {
        "gpt-4o-mini"
    }
    fn complete<'a>(
        &'a self,
        creds: &'a AiCredentials,
        system: &'a str,
        user: &'a str,
    ) -> CompletionFuture<'a> {
        Box::pin(async move {
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
        })
    }
}
