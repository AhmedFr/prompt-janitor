export interface NotificationsTabProps {
  digest: boolean;
  regressions: boolean;
  onDigest: (on: boolean) => void;
  onRegressions: (on: boolean) => void;
}
