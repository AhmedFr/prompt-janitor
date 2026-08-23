import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import type { Severity } from "@/lib/ipc";
import {
  BACK_TO_RULES_LABEL,
  BODY_HINT,
  BODY_HINT_ID,
  BODY_ID,
  BODY_LABEL,
  BODY_PLACEHOLDER,
  CANCEL_LABEL,
  CHANGE_TYPE_LABEL,
  FORM_TITLE,
  KIND_BLURB,
  KIND_TITLE,
  NL_HINT,
  NL_HINT_ID,
  SAVE_LABEL,
  SAVING_LABEL,
  SCREEN_TITLE,
  SEVERITIES,
  SEVERITY_LABEL,
  STEP_TYPE_BLURB,
  STEP_TYPE_TITLE,
  TITLE_ID,
  TITLE_LABEL,
  TITLE_PLACEHOLDER,
} from "./RulesNew.constants";
import type { RuleDraft, RuleKind, RulesNewProps } from "./RulesNew.types";
import { canSave } from "./rulesNew.util";
import { useRulesNew } from "./useRulesNew";
import "./RulesNew.css";

/**
 * Writing a rule, as its own screen (spec §4.3) rather than a composer parked
 * above the Rules tables: two steps, one write, and a return trip that lands
 * on the row it just created. Layout only — every decision lives in
 * {@link useRulesNew} and `rulesNew.util`.
 */
export function RulesNew({ navigate, initialType, aiReady: override }: RulesNewProps) {
  const state = useRulesNew({ initialType, navigate, aiReady: override });

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <button type="button" className="d-back" onClick={state.cancel} aria-label={BACK_TO_RULES_LABEL}>
          <Icon name="chevronRight" size={14} />
        </button>
        <h1 className="screen__title">{SCREEN_TITLE}</h1>
      </header>

      <div className="scroll-area">
        <div className="page rules-new-page">
          {state.kind === null ? (
            <TypeStep aiReady={state.aiReady} onChoose={state.choose} onCancel={state.cancel} />
          ) : (
            <RuleForm
              kind={state.kind}
              draft={state.draft}
              aiReady={state.aiReady}
              saving={state.saving}
              error={state.error}
              onUpdate={state.update}
              onBack={state.back}
              onCancel={state.cancel}
              onSave={() => void state.save()}
            />
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Step 1. Two buttons rather than a radio group: choosing here *is* the
 * navigation — there is no third control to press afterwards — and a control
 * that acts the moment it is activated is a button, whatever it looks like.
 */
function TypeStep({
  aiReady,
  onChoose,
  onCancel,
}: {
  aiReady: boolean | null;
  onChoose: (kind: RuleKind) => void;
  onCancel: () => void;
}) {
  // Only a *known* absence closes the door: `null` is the check still in
  // flight, and greying the card out on unknown would flash a gate at
  // everyone who has a provider configured.
  const nlBlocked = aiReady === false;

  return (
    <>
      <h2 className="rules-new__heading">{STEP_TYPE_TITLE}</h2>
      <p className="rules-new__blurb">{STEP_TYPE_BLURB}</p>

      <div className="rules-new-choices">
        <KindCard kind="pattern" icon="check" onChoose={onChoose} />
        <KindCard
          kind="nl"
          icon="sparkles"
          disabled={nlBlocked}
          describedBy={nlBlocked ? NL_HINT_ID : undefined}
          onChoose={onChoose}
        />
      </div>

      {nlBlocked && (
        <p className="rules-new__hint" id={NL_HINT_ID}>
          {NL_HINT}
        </p>
      )}

      <div className="rules-new-actions">
        <Button type="button" onClick={onCancel}>
          {CANCEL_LABEL}
        </Button>
      </div>
    </>
  );
}

/** One of the two large option cards. */
function KindCard({
  kind,
  icon,
  disabled,
  describedBy,
  onChoose,
}: {
  kind: RuleKind;
  icon: "check" | "sparkles";
  disabled?: boolean;
  describedBy?: string;
  onChoose: (kind: RuleKind) => void;
}) {
  return (
    <button
      type="button"
      className="rules-new-choice"
      disabled={disabled}
      aria-describedby={describedBy}
      onClick={() => onChoose(kind)}
    >
      <span className="rules-new-choice__icon">
        <Icon name={icon} size={15} />
      </span>
      <span className="rules-new-choice__title">{KIND_TITLE[kind]}</span>
      <span className="rules-new-choice__blurb">{KIND_BLURB[kind]}</span>
    </button>
  );
}

/** Step 2. The same three fields for both kinds — only the labels change. */
function RuleForm({
  kind,
  draft,
  aiReady,
  saving,
  error,
  onUpdate,
  onBack,
  onCancel,
  onSave,
}: {
  kind: RuleKind;
  draft: RuleDraft;
  aiReady: boolean | null;
  saving: boolean;
  error: string | null;
  onUpdate: (patch: Partial<RuleDraft>) => void;
  onBack: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  // The natural-language form is reachable straight from the AI tab, so the
  // provider gate has to hold here too — otherwise the deep link routes
  // around the disabled card on the step the user never saw.
  const blocked = kind === "nl" && aiReady === false;

  return (
    <Card padded>
      <form
        className="rules-new-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <h2 className="rules-new__heading">{FORM_TITLE[kind]}</h2>

        <div className="rules-new-field">
          <label className="rules-new-field__label" htmlFor={TITLE_ID}>
            {TITLE_LABEL}
          </label>
          <input
            id={TITLE_ID}
            className="input"
            value={draft.title}
            placeholder={TITLE_PLACEHOLDER}
            onChange={(event) => onUpdate({ title: event.target.value })}
          />
        </div>

        <div className="rules-new-field">
          <label className="rules-new-field__label" htmlFor={BODY_ID}>
            {BODY_LABEL[kind]}
          </label>
          {/* Described by, not labelled by: the hint explains the field, and
              folding it into the accessible name would make every screen
              reader read the whole sentence back as the field's title. */}
          <input
            id={BODY_ID}
            className="input"
            aria-describedby={BODY_HINT_ID}
            value={draft.body}
            placeholder={BODY_PLACEHOLDER[kind]}
            onChange={(event) => onUpdate({ body: event.target.value })}
          />
          <p className="rules-new-field__hint" id={BODY_HINT_ID}>
            {BODY_HINT[kind]}
          </p>
        </div>

        <SeverityChoice value={draft.severity} onChange={(severity) => onUpdate({ severity })} />

        {blocked && <p className="rules-new__hint">{NL_HINT}</p>}
        {error && (
          <p className="rules-new__error" role="alert">
            {error}
          </p>
        )}

        <div className="rules-new-actions">
          <Button type="button" onClick={onBack}>
            {CHANGE_TYPE_LABEL}
          </Button>
          <span className="rules-new-actions__spacer" />
          <Button type="button" onClick={onCancel}>
            {CANCEL_LABEL}
          </Button>
          <Button type="submit" variant="primary" disabled={saving || !canSave(kind, draft, aiReady)}>
            {saving ? SAVING_LABEL : SAVE_LABEL}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * Severity as native radios: one tab stop, arrow keys, and a grouping name —
 * all of it the browser's, none of it ours to keep in sync.
 */
function SeverityChoice({ value, onChange }: { value: Severity; onChange: (value: Severity) => void }) {
  return (
    <fieldset className="rules-new-severity">
      <legend className="rules-new-field__label">{SEVERITY_LABEL}</legend>
      {SEVERITIES.map((option) => (
        <label key={option.value} className="rules-new-severity__option">
          <input
            type="radio"
            name="rules-new-severity"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
