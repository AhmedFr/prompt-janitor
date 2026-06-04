//! Offline license-key entitlement. A license is an Ed25519-signed payload the
//! user pastes in Settings; it's verified against an embedded **public** key, so
//! keys can't be forged without the vendor's private key — and no backend is
//! needed to validate.
//!
//! Format: `PJ1.<base64url(payload_json)>.<base64url(signature)>` where
//! `payload_json` is `{"email":"…","plan":"…"}`.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};

/// The public half of the vendor signing key. Real keys are minted offline with
/// the matching private key, which never ships.
const PUBKEY: [u8; 32] = [
    0xc2, 0x5e, 0x46, 0x5d, 0x56, 0x53, 0xb0, 0xb1, 0xe0, 0x65, 0xf6, 0x65, 0x00, 0x49, 0xcd, 0x20,
    0x5e, 0x18, 0xe7, 0x22, 0x58, 0x03, 0xf7, 0x38, 0xd0, 0x02, 0x8c, 0xe0, 0x53, 0x95, 0x8d, 0x17,
];

const PREFIX: &str = "PJ1.";

/// What a valid license unlocks, shown in Settings.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct LicenseInfo {
    pub email: String,
    pub plan: String,
}

/// The current entitlement state (whether the paid tier is unlocked).
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct Entitlement {
    pub paid: bool,
    pub email: Option<String>,
    pub plan: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct Payload {
    email: String,
    plan: String,
}

/// Verify `license` against a specific key. Returns the payload if the
/// signature checks out. Pure — used by both [`verify`] and the tests.
pub fn verify_with(license: &str, key: &VerifyingKey) -> Option<LicenseInfo> {
    let rest = license.trim().strip_prefix(PREFIX)?;
    let (payload_b64, sig_b64) = rest.split_once('.')?;
    let payload_bytes = URL_SAFE_NO_PAD.decode(payload_b64).ok()?;
    let sig_bytes = URL_SAFE_NO_PAD.decode(sig_b64).ok()?;
    let sig = Signature::from_slice(&sig_bytes).ok()?;
    key.verify(&payload_bytes, &sig).ok()?;
    let payload: Payload = serde_json::from_slice(&payload_bytes).ok()?;
    Some(LicenseInfo {
        email: payload.email,
        plan: payload.plan,
    })
}

/// Verify `license` against the embedded vendor key.
pub fn verify(license: &str) -> Option<LicenseInfo> {
    let key = VerifyingKey::from_bytes(&PUBKEY).ok()?;
    verify_with(license, &key)
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;
    use ed25519_dalek::{Signer, SigningKey};

    /// Mint a license signed by `signing` — the vendor-side operation, exercised
    /// here so the verify path has something valid to check.
    fn mint(email: &str, plan: &str, signing: &SigningKey) -> String {
        let payload = serde_json::to_vec(&Payload {
            email: email.to_string(),
            plan: plan.to_string(),
        })
        .unwrap();
        let sig = signing.sign(&payload);
        format!(
            "{PREFIX}{}.{}",
            URL_SAFE_NO_PAD.encode(&payload),
            URL_SAFE_NO_PAD.encode(sig.to_bytes())
        )
    }

    fn keypair() -> (SigningKey, VerifyingKey) {
        let signing = SigningKey::from_bytes(&[7u8; 32]);
        let verifying = signing.verifying_key();
        (signing, verifying)
    }

    #[test]
    fn a_valid_key_unlocks() {
        let (signing, verifying) = keypair();
        let license = mint("dev@example.com", "pro", &signing);
        let info = verify_with(&license, &verifying).expect("valid license");
        assert_eq!(info.email, "dev@example.com");
        assert_eq!(info.plan, "pro");
    }

    #[test]
    fn a_tampered_payload_is_rejected() {
        let (signing, verifying) = keypair();
        let license = mint("dev@example.com", "pro", &signing);
        // Flip the payload to a different email while keeping the old signature.
        let forged_payload = URL_SAFE_NO_PAD.encode(
            serde_json::to_vec(&Payload {
                email: "evil@example.com".to_string(),
                plan: "pro".to_string(),
            })
            .unwrap(),
        );
        let sig = license.rsplit_once('.').unwrap().1;
        let forged = format!("{PREFIX}{forged_payload}.{sig}");
        assert!(verify_with(&forged, &verifying).is_none());
    }

    #[test]
    fn a_key_from_another_signer_is_rejected() {
        let (signing, _) = keypair();
        let license = mint("dev@example.com", "pro", &signing);
        let other = SigningKey::from_bytes(&[9u8; 32]).verifying_key();
        assert!(verify_with(&license, &other).is_none());
    }

    #[test]
    fn garbage_is_rejected() {
        let (_, verifying) = keypair();
        assert!(verify_with("not-a-license", &verifying).is_none());
        assert!(verify_with("PJ1.zzz.zzz", &verifying).is_none());
        assert!(verify_with("", &verifying).is_none());
    }
}
