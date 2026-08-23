import type { Meta, StoryObj } from "@storybook/react";
import { RulesNew } from "./RulesNew";
import "@/styles/shell.css";
import "@/screens/Detail/Detail.css";

/**
 * Writing a rule, as its own screen: choose the kind, fill three fields, and
 * land back on the Rules tab the new rule belongs to. Storybook has no Tauri
 * to ask about a provider, so `aiReady` is passed explicitly — in the app it
 * comes from `get_ai_config`.
 */
const meta = {
  title: "Screens/RulesNew",
  component: RulesNew,
  args: { navigate: () => {}, aiReady: true },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ height: "100vh", background: "var(--bg)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RulesNew>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Step 1: the two kinds of rule, both available. */
export const ChooseType: Story = {};

/**
 * Step 1 with no AI provider configured — the natural-language card is out of
 * reach and says what would bring it back. Gated on the provider alone:
 * monetisation is paused, so a licence decides nothing here.
 */
export const NoProvider: Story = {
  args: { aiReady: false },
};

/**
 * The pattern form, reached from the Custom tab. Save stays disabled until
 * both fields carry something other than whitespace.
 */
export const PatternForm: Story = {
  args: { initialType: "custom" },
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>(".rules-new-choice")?.click();
  },
};

/** The natural-language form, reached straight from the AI standards tab. */
export const NaturalLanguageForm: Story = {
  args: { initialType: "ai" },
};

/**
 * The same form when the deep link outran the provider check: the gate holds
 * here too, so the AI tab cannot route around the disabled card.
 */
export const NaturalLanguageBlocked: Story = {
  args: { initialType: "ai", aiReady: false },
};
