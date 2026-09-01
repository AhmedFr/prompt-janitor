import { Icon } from "@/components/Icon";
import type { UpdateBannerProps } from "./UpdateBanner.types";
import "./UpdateBanner.css";

/**
 * "A new version is out" as a line of chrome rather than a dialog.
 *
 * The launch check is a background probe (see {@link useUpdateCheck}); a modal
 * would put an interruption in front of work the user came to do, for news
 * that can wait. This bar states the version, offers the one action that
 * matters, and gets out of the way when dismissed.
 */
export function UpdateBanner({ version, onOpen, onDismiss }: UpdateBannerProps) {
  return (
    <div className="update-banner">
      <span className="update-banner__icon">
        <Icon name="arrowDown" size={16} />
      </span>
      {/* The live region is the sentence, not the bar: a `role="status"`
          wrapping the buttons would re-announce them as controls appear or
          change, and screen readers treat a live region's contents as text. */}
      <span className="update-banner__text" role="status">
        Prompt Janitor {version} is available
      </span>
      <button className="update-banner__open" onClick={onOpen}>
        Open Settings
      </button>
      <button
        className="update-banner__dismiss"
        aria-label="Dismiss update notice"
        onClick={onDismiss}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
