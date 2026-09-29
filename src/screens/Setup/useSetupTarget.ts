import { useCallback, useState } from "react";
import { formatSetupTarget, type SetupTarget } from "@/App/setupTarget";
import type { SetupChangeMode, SetupProps, SetupTargetControl } from "./Setup.types";

/** One shared "nothing selected", so an absent target keeps its identity across renders. */
const NOTHING: SetupTarget = {};

/**
 * Setup's one piece of navigation state. Controlled by the shell when
 * `onTargetChange` is given (the value is `target`, changes are reported and
 * never held); uncontrolled otherwise (stories, tests), where it holds the
 * value itself and follows a new `target`.
 */
export function useSetupTarget(
  target: SetupTarget | undefined,
  onTargetChange?: SetupProps["onTargetChange"],
): SetupTargetControl {
  const [local, setLocal] = useState<SetupTarget>(target ?? NOTHING);
  // A new target is followed by what it says, not by its identity: a caller
  // writing `target={{ kind: "skill" }}` hands over a fresh object each render.
  const link = formatSetupTarget(target ?? NOTHING) ?? "";
  const [followed, setFollowed] = useState(link);
  // (Controlled, `target` is read directly and there is nothing to follow.)
  if (!onTargetChange && link !== followed) {
    setFollowed(link);
    setLocal(target ?? NOTHING);
  }
  const change = useCallback(
    (next: SetupTarget, mode: SetupChangeMode) => {
      if (onTargetChange) onTargetChange(next, mode);
      else setLocal(next);
    },
    [onTargetChange],
  );
  return { value: onTargetChange ? (target ?? NOTHING) : local, change };
}
