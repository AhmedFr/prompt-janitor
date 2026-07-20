import { PromptsMock } from "@/components/mockups/PromptsMock";
import { DetailMock } from "@/components/mockups/DetailMock";
import { RulesMock } from "@/components/mockups/RulesMock";
import { PopoverMock } from "@/components/mockups/PopoverMock";

export function FeatureRows() {
  return (
    <section className="section tint" id="features">
      <div className="wrap">
        <div className="feature">
          <div className="f-text">
            <span className="eyebrow">
              <span className="grade lg gA">A</span> Health scores
            </span>
            <h3>Every prompt, graded A to F</h3>
            <p>
              One health score per file, rolled up per project. Watch grades rise and fall as you edit, so you never have to guess
              whether a prompt is actually any good.
            </p>
          </div>
          <div className="f-media">
            <PromptsMock />
          </div>
        </div>

        <div className="feature flip">
          <div className="f-text">
            <span className="eyebrow">
              <span className="sev hi"></span> <span className="src person">Karpathy</span> <span className="src anthropic">Anthropic</span>
            </span>
            <h3>Catches what's rotting</h3>
            <p>
              Stale model names, contradictory instructions, missing examples, walls of text. Every issue is cited to its source
              (Anthropic, OpenAI, or the practitioners who wrote the playbook) and comes with a suggested fix.
            </p>
          </div>
          <div className="f-media">
            <DetailMock />
          </div>
        </div>

        <div className="feature">
          <div className="f-text">
            <span className="eyebrow">
              <span className="src custom">Your rule</span> Standards
            </span>
            <h3>Your standards, enforced</h3>
            <p>
              Start from trusted rule packs, then write your own in plain English. “Never name a specific model version.” Done, and
              checked on every scan, every file.
            </p>
          </div>
          <div className="f-media">
            <RulesMock />
          </div>
        </div>

        <div className="feature flip">
          <div className="f-text">
            <span className="eyebrow">Calm by design</span>
            <h3>Quiet by default</h3>
            <p>
              Scans in the background on your schedule. A glance from the menu bar, a calm weekly digest, and alerts only when something
              regresses. Never naggy.
            </p>
          </div>
          <div className="f-media">
            <PopoverMock />
          </div>
        </div>
      </div>
    </section>
  );
}
