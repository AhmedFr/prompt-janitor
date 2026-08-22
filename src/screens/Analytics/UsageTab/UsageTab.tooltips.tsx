import type { TooltipContentProps } from "recharts";
import type { ErrorRateBar, KindBar, SessionBar, TipLine } from "./UsageTab.types";
import { shortDay } from "./usageTab.util";

type TipProps = TooltipContentProps;

/** Shared tooltip shell: a title plus rows whose colour dot carries identity. */
export function Tip({ title, lines }: { title: string; lines: TipLine[] }) {
  return (
    <div className="usage-tip">
      <div className="usage-tip__title">{title}</div>
      {lines.map((line) => (
        <div key={line.text} className="usage-tip__row">
          {line.color && <span className="usage-swatch" style={{ background: line.color }} />}
          <span>{line.text}</span>
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

/** Crosshair tooltip for the top-targets line chart: every series on that day. */
export function SeriesTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  const lines: TipLine[] = [...payload]
    .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0))
    .map((entry) => ({
      color: entry.color,
      text: `${entry.name}: ${plural(Number(entry.value ?? 0), "invocation")}`,
    }));
  return <Tip title={shortDay(String(label))} lines={lines} />;
}

/** Invocations by kind, with the harness's context-token average per turn. */
export function KindTooltip({ active, payload }: TipProps) {
  const bar = hoveredRow<KindBar>(payload);
  if (!active || !bar) return null;
  const tokens = bar.avgTurnTokens === null ? "not recorded" : bar.avgTurnTokens.toLocaleString();
  return (
    <Tip
      title={bar.label}
      lines={[
        { text: plural(bar.total, "invocation") },
        { text: `avg context tokens / turn: ${tokens}` },
      ]}
    />
  );
}

/** One MCP server's error rate, over the call volume it is measured on. */
export function ErrorTooltip({ active, payload }: TipProps) {
  const bar = hoveredRow<ErrorRateBar>(payload);
  if (!active || !bar) return null;
  return (
    <Tip
      title={bar.target}
      lines={[
        { text: `${bar.pct.toFixed(1)}% of calls errored` },
        { text: plural(bar.total, "call") },
      ]}
    />
  );
}

/** One project's top-level session count, with the path it was counted from. */
export function SessionsTooltip({ active, payload }: TipProps) {
  const bar = hoveredRow<SessionBar>(payload);
  if (!active || !bar) return null;
  return (
    <Tip title={bar.name} lines={[{ text: plural(bar.sessions, "session") }, { text: bar.path }]} />
  );
}

function plural(n: number, noun: string): string {
  return `${n.toLocaleString()} ${noun}${n === 1 ? "" : "s"}`;
}
