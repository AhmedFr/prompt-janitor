import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { useBack } from "@/App/navigation/NavigationContext";
import type { BackButtonProps } from "./BackButton.types";

/**
 * The toolbar's Back arrow (spec §10), first in every screen's toolbar. At
 * the start of history there is nowhere to go, so it is not drawn at all.
 */
export function BackButton(_props: BackButtonProps) {
  const { canGoBack, back } = useBack();
  if (!canGoBack) return null;
  return (
    <Button size="icon" aria-label="Back" title="Back (⌘[)" onClick={back}>
      <Icon name="chevronRight" style={{ transform: "rotate(180deg)" }} />
    </Button>
  );
}
