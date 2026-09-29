import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { NEXT_ITEM, NEXT_TITLE, PREVIOUS_ITEM, PREVIOUS_TITLE } from "./StepButtons.constants";
import type { StepButtonsProps } from "./StepButtons.types";

/** ↑/↓ beside the file's actions: the pointer's way to ⌘↑/⌘↓. */
export function StepButtons({ onStep, disabled = false }: StepButtonsProps) {
  return (
    <span className="iv-step">
      <Button
        size="icon"
        aria-label={PREVIOUS_ITEM}
        title={PREVIOUS_TITLE}
        disabled={disabled}
        onClick={() => onStep(-1)}
      >
        <Icon name="chevronUp" size={13} />
      </Button>
      <Button size="icon" aria-label={NEXT_ITEM} title={NEXT_TITLE} disabled={disabled} onClick={() => onStep(1)}>
        <Icon name="chevronDown" size={13} />
      </Button>
    </span>
  );
}
