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
            <h3>&ldquo;Is this prompt any good?&rdquo; Stop guessing.</h3>
            <p>
              One health score per file, rolled up per project. Watch grades rise and fall as you edit, so the answer is
              always on screen instead of in your gut.
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
            <h3>Find the rot before your agent trips on it</h3>
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
            <h3>House rules die in Slack threads. Not anymore.</h3>
            <p>
              Start from trusted rule packs, then write your own in plain English. “Never name a specific model version.” Done, and
              enforced on every scan, every file.
            </p>
          </div>
          <div className="f-media">
            <RulesMock />
          </div>
        </div>

        <div className="feature flip">
          <div className="f-text">
            <span className="eyebrow">Calm by design</span>
            <h3>Not another dashboard to babysit</h3>
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
