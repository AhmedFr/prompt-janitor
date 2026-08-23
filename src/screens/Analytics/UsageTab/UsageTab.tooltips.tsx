import type { TooltipContentProps } from "recharts";
import type { KindBar, SessionBar } from "./UsageTab.types";
// A deep import rather than the screen barrel: `plural` is a pure formatter,
// and the barrel would pull a whole screen in behind it.
import { plural } from "@/screens/Setup/setup.util";

type TipProps = TooltipContentProps;

/**
 * Shared tooltip shell: a title over one line per fact. Both charts are
 * single-series, so a hovered mark is named by the title alone — there is no
 * second series for a colour swatch to tell it apart from.
 */
function Tip({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="usage-tip">
      <div className="usage-tip__title">{title}</div>
      {lines.map((line) => (
        <div key={line} className="usage-tip__row">
          {line}
        </div>
      ))}
    </div>
  );
}

/**
 * The chart row a hovered mark was built from. Recharts types payload entries
 * as `any`, so this is the one place that names the row type.
 */
function hoveredRow<T>(payload: TipProps["payload"]): T | undefined {
  return payload?.[0]?.payload as T | undefined;
}

/** Invocations by kind, with the harness's context-token average per turn. */
export function KindTooltip({ active, payload }: TipProps) {
  const bar = hoveredRow<KindBar>(payload);
  if (!active || !bar) return null;
  const tokens = bar.avgTurnTokens === null ? "not recorded" : bar.avgTurnTokens.toLocaleString();
  return (
    <Tip
      title={bar.label}
      lines={[plural(bar.total, "invocation"), `avg context tokens / turn: ${tokens}`]}
    />
  );
}

/** One project's top-level session count, with the path it was counted from. */
export function SessionsTooltip({ active, payload }: TipProps) {
  const bar = hoveredRow<SessionBar>(payload);
  if (!active || !bar) return null;
  return (
    <Tip title={bar.name} lines={[plural(bar.sessions, "session"), bar.path]} />
  );
}
