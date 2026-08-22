//! OpenRouter: OpenAI-compatible gateway to many models. Model ids look like
//! `vendor/model` (e.g. `anthropic/claude-sonnet-4.6`).

use serde_json::{json, Value};

use super::provider::{CompletionFuture, LlmProvider};
use super::AiCredentials;

pub struct OpenRouter;

pub(super) fn request_body(model: &str, system: &str, user: &str) -> Value {
    json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user },
        ],
    })
}

impl LlmProvider for OpenRouter {
    fn id(&self) -> &'static str {
        "openrouter"
    }
    fn default_model(&self) -> &'static str {
        "anthropic/claude-sonnet-4.6"
    }
    fn complete<'a>(
        &'a self,
        creds: &'a AiCredentials,
        system: &'a str,
        user: &'a str,
    ) -> CompletionFuture<'a> {
        Box::pin(async move {
            let resp = reqwest::Client::new()
                .post("https://openrouter.ai/api/v1/chat/completions")
                .bearer_auth(&creds.key)
                .header("HTTP-Referer", "https://promptjanitor.app")
                .header("X-Title", "Prompt Janitor")
                .json(&request_body(&creds.model, system, user))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!("OpenRouter error {status}: {body}"));
            }
            let value: Value = resp.json().await.map_err(|e| e.to_string())?;
            Ok(value["choices"][0]["message"]["content"]
                .as_str()
                .unwrap_or_default()
                .to_string())
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_body_is_openai_compatible() {
        let body = request_body("anthropic/claude-sonnet-4.6", "sys", "usr");
        assert_eq!(body["model"], "anthropic/claude-sonnet-4.6");
        assert_eq!(body["messages"][0]["role"], "system");
        assert_eq!(body["messages"][0]["content"], "sys");
        assert_eq!(body["messages"][1]["role"], "user");
        assert_eq!(body["messages"][1]["content"], "usr");
    }
}
