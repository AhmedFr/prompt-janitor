import type { Meta, StoryObj } from "@storybook/react";
import { UsageBadge } from "./UsageBadge";
import type { UsageStat } from "@/lib/ipc";

const now = new Date("2026-08-21T12:00:00Z");
const stat = (o: Partial<UsageStat> = {}): UsageStat => ({
  total: 42,
  sessions: 12,
  last_used: "2026-08-18T12:00:00.000Z",
  error_rate: 0,
  avg_turn_tokens: null,
  count_30d: 5,
  count_prev_30d: 3,
  ...o,
});

const meta = {
  title: "Components/UsageBadge",
  component: UsageBadge,
  args: { usage: stat(), now },
} satisfies Meta<typeof UsageBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Used: Story = {};

export const Never: Story = { args: { usage: null, now } };

/** The label names the error rate, so the red is confirmation and not the message. */
export const ErrorProne: Story = {
  args: { usage: stat({ total: 40, error_rate: 0.42 }), now },
};

/** Likewise "stale" is written out next to the date that made it stale. */
export const Stale: Story = {
  args: { usage: stat({ total: 9, sessions: 4, last_used: "2026-05-01T00:00:00.000Z" }), now },
};

/** All four tones together — the palette this screen's evidence is read through. */
export const AllTones: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "start", gap: 8 }}>
      <UsageBadge usage={stat()} now={now} />
      <UsageBadge usage={null} now={now} />
      <UsageBadge usage={stat({ total: 40, error_rate: 0.42 })} now={now} />
      <UsageBadge
        usage={stat({ total: 9, sessions: 4, last_used: "2026-05-01T00:00:00.000Z" })}
        now={now}
      />
    </div>
  ),
};
