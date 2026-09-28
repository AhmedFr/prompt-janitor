import type { Meta, StoryObj } from "@storybook/react";
import { AddCheck } from "./AddCheck";

/**
 * Writing a check: choose the kind, fill three fields, and land back on the
 * rule table the new check belongs to. It has no screen chrome of its own —
 * it renders inside the Checks tab's body, in the place `ChecksLibrary`
 * otherwise holds — so the decorator here is the same `.page` wrapper
 * Settings puts around every tab, not a full-screen frame.  Storybook has no
 * Tauri to ask about a provider, so `aiReady` is passed explicitly — in the
 * app it comes from `get_ai_config`.
 */
const meta = {
  title: "Settings/AddCheck",
  component: AddCheck,
  args: { onDone: () => {}, aiReady: true },
  decorators: [
    (Story) => (
      <div className="page" style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AddCheck>;

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
