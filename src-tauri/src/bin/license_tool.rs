//! Vendor-side license tool. Generates the Ed25519 signing keypair and mints
//! the `PJ1.…` license keys customers paste into Settings. The private key
//! stays on the vendor's machine; only the public half is embedded in the app
//! (`license.rs`). Run with `cargo run --bin license-tool -- <command>`.

use std::path::Path;
use std::process::ExitCode;

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use ed25519_dalek::SigningKey;
use prompt_janitor_lib::license;

const USAGE: &str = "\
license-tool — mint and verify Prompt Janitor license keys

USAGE:
  license-tool keygen [--out <file>]            generate a vendor keypair
                                                (default: pj-vendor-key.secret)
  license-tool mint --key <file> --email <email> [--plan <plan>]
                                                mint a customer license (default plan: pro)
  license-tool verify <license>                 check a license against the embedded public key
";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.first().map(String::as_str) {
        Some("keygen") => keygen(&args[1..]),
        Some("mint") => mint(&args[1..]),
        Some("verify") => verify(&args[1..]),
        _ => Err(USAGE.to_string()),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("{message}");
            ExitCode::FAILURE
        }
    }
}

/// Read the value following a `--flag` style argument.
fn flag_value(args: &[String], flag: &str) -> Option<String> {
    args.iter()
        .position(|a| a == flag)
        .and_then(|i| args.get(i + 1))
        .cloned()
}

fn keygen(args: &[String]) -> Result<(), String> {
    let out = flag_value(args, "--out").unwrap_or_else(|| "pj-vendor-key.secret".to_string());
    if Path::new(&out).exists() {
        return Err(format!(
            "refusing to overwrite existing key file: {out}\nPass --out <file> to write elsewhere."
        ));
    }

    let mut seed = [0u8; 32];
    getrandom::getrandom(&mut seed).map_err(|e| format!("could not gather entropy: {e}"))?;
    let signing = SigningKey::from_bytes(&seed);
    let public = signing.verifying_key();

    std::fs::write(&out, URL_SAFE_NO_PAD.encode(seed))
        .map_err(|e| format!("could not write {out}: {e}"))?;

    let rust_array = public
        .to_bytes()
        .iter()
        .map(|b| format!("0x{b:02x}"))
        .collect::<Vec<_>>()
        .join(", ");

    println!("Private key written to: {out}");
    println!("Keep it out of the repo — store it in a password manager and delete the file.");
    println!();
    println!("Public key for src-tauri/src/license.rs (replace the PUBKEY array):");
    println!("const PUBKEY: [u8; 32] = [\n    {rust_array},\n];");
    println!();
    match license::embedded_key() {
        Some(embedded) if embedded == public => {
            println!("This key matches the embedded PUBKEY — builds will accept its licenses.")
        }
        _ => println!(
            "NOTE: this key does NOT match the current embedded PUBKEY. Paste the array \
             above into license.rs and rebuild before minting real customer keys."
        ),
    }
    Ok(())
}

/// Load the signing key from the base64url seed file `keygen` writes.
fn load_signing_key(path: &str) -> Result<SigningKey, String> {
    let encoded = std::fs::read_to_string(path)
        .map_err(|e| format!("could not read key file {path}: {e}"))?;
    let bytes = URL_SAFE_NO_PAD
        .decode(encoded.trim())
        .map_err(|e| format!("key file {path} is not valid base64url: {e}"))?;
    let seed: [u8; 32] = bytes
        .try_into()
        .map_err(|_| format!("key file {path} must decode to exactly 32 bytes"))?;
    Ok(SigningKey::from_bytes(&seed))
}

fn mint(args: &[String]) -> Result<(), String> {
    let key_path = flag_value(args, "--key").ok_or(USAGE)?;
    let email = flag_value(args, "--email").ok_or(USAGE)?;
    let plan = flag_value(args, "--plan").unwrap_or_else(|| "pro".to_string());

    let signing = load_signing_key(&key_path)?;
    let license_key = license::mint_with(&email, &plan, &signing);

    if license::verify(&license_key).is_none() {
        eprintln!(
            "WARNING: this license does NOT verify against the embedded PUBKEY in this build. \
             Shipping apps will reject it — run `keygen`, update license.rs, and rebuild first."
        );
    }
    println!("{license_key}");
    Ok(())
}

fn verify(args: &[String]) -> Result<(), String> {
    let key = args.first().ok_or(USAGE)?;
    match license::verify(key) {
        Some(info) => {
            println!("valid — email: {}, plan: {}", info.email, info.plan);
            Ok(())
        }
        None => Err("invalid: license does not verify against the embedded public key".into()),
    }
}
