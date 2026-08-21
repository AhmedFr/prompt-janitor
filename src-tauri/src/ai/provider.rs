//! Provider seam: one module per LLM vendor, registered here.

use std::future::Future;
use std::pin::Pin;

use super::AiCredentials;

pub type CompletionFuture<'a> = Pin<Box<dyn Future<Output = Result<String, String>> + Send + 'a>>;

/// A chat-completion backend. Implementations are stateless singletons.
pub trait LlmProvider: Sync {
    /// Stable id stored in the `ai_provider` setting.
    fn id(&self) -> &'static str;
    /// Model used when the user has not picked one.
    fn default_model(&self) -> &'static str;
    /// One system+user completion; returns the assistant text.
    fn complete<'a>(
        &'a self,
        creds: &'a AiCredentials,
        system: &'a str,
        user: &'a str,
    ) -> CompletionFuture<'a>;
}

static PROVIDERS: &[&dyn LlmProvider] = &[&super::anthropic::Anthropic, &super::openai::OpenAi];

pub fn provider_for(id: &str) -> Option<&'static dyn LlmProvider> {
    PROVIDERS.iter().copied().find(|p| p.id() == id)
}

// Not called within this task; part of the seam Task 2 (provider selection UI) consumes.
#[allow(dead_code)]
pub fn provider_ids() -> Vec<&'static str> {
    PROVIDERS.iter().map(|p| p.id()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_knows_builtin_providers() {
        assert_eq!(provider_for("anthropic").map(|p| p.id()), Some("anthropic"));
        assert_eq!(provider_for("openai").map(|p| p.id()), Some("openai"));
        assert!(provider_for("none").is_none());
        assert!(provider_for("nope").is_none());
    }

    #[test]
    fn default_models_come_from_providers() {
        assert_eq!(
            provider_for("anthropic").unwrap().default_model(),
            "claude-sonnet-4-6"
        );
        assert_eq!(
            provider_for("openai").unwrap().default_model(),
            "gpt-4o-mini"
        );
    }
}
