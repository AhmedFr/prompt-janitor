//! Timestamp conversions shared by the harness indexers and the store.
//!
//! Harness logs and the database both speak the same RFC3339 shape
//! (`YYYY-MM-DDTHH:MM:SS.mmmZ`), so the two directions live together: no
//! date-time dependency, and both use Howard Hinnant's civil-days algorithm.

/// `YYYY-MM-DDTHH:MM:SS(.mmm)Z` → milliseconds since epoch. No tz offsets
/// (Claude Code always writes UTC `Z`).
pub fn epoch_ms(ts: &str) -> Option<i64> {
    let ts = ts.strip_suffix('Z')?;
    let (date, time) = ts.split_once('T')?;
    let mut d = date.split('-').map(|x| x.parse::<i64>());
    let (y, m, day) = (d.next()?.ok()?, d.next()?.ok()?, d.next()?.ok()?);
    let (hms, ms) = time.split_once('.').unwrap_or((time, "0"));
    let mut t = hms.split(':').map(|x| x.parse::<i64>());
    let (h, mi, s) = (t.next()?.ok()?, t.next()?.ok()?, t.next()?.ok()?);
    // Char-based so a non-ASCII millis field can never split a byte boundary.
    let ms: i64 = ms
        .chars()
        .chain(std::iter::repeat('0'))
        .take(3)
        .try_fold(0i64, |a, c| Some(a * 10 + c.to_digit(10)? as i64))?;
    // The crate builds with `panic = "abort"`, so out-of-range fields must be
    // rejected rather than allowed to overflow the arithmetic below.
    if !(1..=9999).contains(&y)
        || !(1..=12).contains(&m)
        || !(1..=31).contains(&day)
        || !(0..=23).contains(&h)
        || !(0..=59).contains(&mi)
        || !(0..=60).contains(&s)
    {
        return None;
    }
    // Days from civil (Howard Hinnant's algorithm).
    let (y2, m2) = if m <= 2 { (y - 1, m + 9) } else { (y, m - 3) };
    let era = y2.div_euclid(400);
    let yoe = y2 - era * 400;
    let doy = (153 * m2 + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146_097 + doe - 719_468;
    Some((((days * 24 + h) * 60 + mi) * 60 + s) * 1000 + ms)
}

/// Seconds since epoch → `YYYY-MM-DDTHH:MM:SS.000Z`, the shape harness logs
/// write, so windows can be compared against `invocations.ts` lexicographically.
pub fn iso_from_epoch(secs: i64) -> String {
    // Civil from days (Howard Hinnant) — the inverse of `epoch_ms`.
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}.000Z",
        rem / 3600,
        (rem % 3600) / 60,
        rem % 60
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn epoch_ms_parses_log_timestamps() {
        assert_eq!(epoch_ms("1970-01-01T00:00:01.500Z"), Some(1500));
        assert_eq!(
            epoch_ms("2026-08-01T10:00:00.000Z").map(|v| v % 1000),
            Some(0)
        );
        assert_eq!(epoch_ms("garbage"), None);
    }

    /// Non-ASCII digits in the millis field must not be byte-sliced.
    #[test]
    fn epoch_ms_rejects_non_ascii_millis_without_panicking() {
        assert_eq!(epoch_ms("2026-08-01T10:00:00.\u{1D7D8}Z"), None);
        assert_eq!(epoch_ms("2026-08-01T10:00:00.\u{1F600}Z"), None);
    }

    /// Absurd field values must not overflow the civil-days math (panic=abort).
    #[test]
    fn epoch_ms_rejects_out_of_range_fields_without_overflowing() {
        assert_eq!(epoch_ms("300000000000-01-01T00:00:00.000Z"), None);
        assert_eq!(epoch_ms("2026-01-99999999999T00:00:00.000Z"), None);
    }

    /// The two directions are inverses on every field, including the epoch and
    /// dates either side of a leap day.
    #[test]
    fn iso_from_epoch_inverts_epoch_ms() {
        assert_eq!(iso_from_epoch(0), "1970-01-01T00:00:00.000Z");
        for ts in [
            "1970-01-01T00:00:00.000Z",
            "2024-02-29T23:59:59.000Z",
            "2026-08-01T10:00:00.000Z",
            "2026-08-02T00:00:00.000Z",
        ] {
            let secs = epoch_ms(ts).unwrap() / 1000;
            assert_eq!(iso_from_epoch(secs), ts, "round trip of {ts}");
        }
    }

    /// Pre-epoch seconds floor to the right civil day rather than truncating
    /// toward zero.
    #[test]
    fn iso_from_epoch_handles_negative_seconds() {
        assert_eq!(iso_from_epoch(-1), "1969-12-31T23:59:59.000Z");
    }
}
