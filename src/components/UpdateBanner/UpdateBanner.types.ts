export interface UpdateBannerProps {
  /** The version the updater endpoint offers, e.g. "0.1.1". */
  version: string;
  /** Take the user to Settings → App, where the install lives. */
  onOpen: () => void;
  /** Hide the bar for the rest of the session. */
  onDismiss: () => void;
}
