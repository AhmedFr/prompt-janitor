import { Sheet } from "@/components/Sheet";
import { SourceViewer } from "@/components/SourceViewer";
import { TEXT_HEADING } from "./RulePanel.constants";
import type { RulePanelProps } from "./RulePanel.types";
import { ruleFacts } from "./rulePanel.util";
import "./RulePanel.css";

/**
 * One rule, read in full: what it is, the description the table only shows
 * on hover, and the text it matches or asks for. Read-only — the row's
 * switch and actions stay where they are.
 */
export function RulePanel({ rule, onClose }: RulePanelProps) {
  return (
    <Sheet title={rule.title} ariaLabel={`${rule.title} — rule`} onClose={onClose}>
      <dl className="rp__facts">
        {ruleFacts(rule).map(([label, value]) => (
          <div className="rp__fact" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {rule.description && (
        <section className="rp__section">
          <h3 className="rp__heading">Description</h3>
          <p className="rp__description">{rule.description}</p>
        </section>
      )}

      {rule.pattern && (
        <section className="rp__section">
          <h3 className="rp__heading">{rule.nl ? TEXT_HEADING.nl : TEXT_HEADING.pattern}</h3>
          <SourceViewer content={rule.pattern} format="text" />
        </section>
      )}
    </Sheet>
  );
}
