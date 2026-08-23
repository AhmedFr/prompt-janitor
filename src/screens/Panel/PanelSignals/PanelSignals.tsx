import { signalTone } from "../panel.util";
import { SIGNALS, signalLabel } from "./PanelSignals.constants";
import type { PanelSignalsProps } from "./PanelSignals.types";
import "./PanelSignals.css";

/**
 * What the setup is doing behind the grades: skills nobody invokes, MCP
 * servers that error, and today's session count. Each chip is a button —
 * a count with nowhere to go is trivia.
 */
export function PanelSignals({ onOpen, ...counts }: PanelSignalsProps) {
  return (
    <section className="panel-signals">
      {SIGNALS.map((signal) => {
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
