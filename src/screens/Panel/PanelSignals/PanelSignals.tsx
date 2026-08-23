import { signalTone } from "../panel.util";
import { ALL_CLEAR, SIGNALS, signalLabel } from "./PanelSignals.constants";
import type { PanelSignalsProps } from "./PanelSignals.types";
import "./PanelSignals.css";

/**
 * What the setup is doing behind the grades: skills nobody invokes, MCP
 * servers that error, and today's session count. Each chip is a button —
 * a count with nowhere to go is trivia.
 *
 * A problem chip disappears at zero rather than reading "0 never-used skills":
 * the panel is 360 px wide, and a chip that reports the absence of a problem
 * spends that width on nothing. When both problems are gone the panel says so
 * once, in a line that is not a button because there is nowhere to go.
 */
export function PanelSignals({ onOpen, ...counts }: PanelSignalsProps) {
  const problems = SIGNALS.filter((signal) => signal.toned && signal.count(counts) > 0);
  const context = SIGNALS.filter((signal) => !signal.toned);

  return (
    <section className="panel-signals">
      {problems.length === 0 && <p className="muted panel-signals__clear">{ALL_CLEAR}</p>}
      {[...problems, ...context].map((signal) => {
        const count = signal.count(counts);
        const text = signal.text(count);
        return (
          <button
            key={signal.id}
            type="button"
            className="panel-signal"
            data-tone={signal.toned ? signalTone(count) : "ok"}
            // The chip's text is a count; its label has to say where clicking lands.
            aria-label={signalLabel(text, signal.destination)}
            onClick={() => onOpen(signal.route, signal.target)}
          >
            {text}
          </button>
        );
      })}
    </section>
  );
}
