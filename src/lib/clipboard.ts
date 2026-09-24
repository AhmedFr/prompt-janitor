/**
 * Puts `text` on the clipboard; resolves to whether it got there.
 *
 * The async Clipboard API first. WKWebView grants it only inside a user
 * gesture and can refuse it outright, so a refusal falls back to the old
 * select-a-textarea-and-copy route rather than failing a button the user
 * just pressed.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea route.
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
