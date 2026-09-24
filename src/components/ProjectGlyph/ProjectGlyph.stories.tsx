import type { Meta, StoryObj } from "@storybook/react";
import { ProjectGlyph } from "./ProjectGlyph";

/** A 16px blue rounded square, standing in for a detected project logo. */
const SVG_LOGO =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="4" fill="#3b82f6"/><path d="M5 11V5h3.5a2 2 0 010 4H5" stroke="#fff" stroke-width="1.6" fill="none"/></svg>',
  );

const meta = {
  title: "Components/ProjectGlyph",
  component: ProjectGlyph,
  args: { name: "web-app", grade: "B", size: 26 },
  argTypes: {
    grade: { control: "select", options: ["A", "B", "C", "D", "F"] },
  },
} satisfies Meta<typeof ProjectGlyph>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithLogo: Story = { args: { logo: SVG_LOGO } };

export const Folder: Story = { args: { logo: null } };

/** A logo the webview cannot decode falls back to the folder. */
export const BrokenLogo: Story = { args: { logo: "data:image/png;base64,bm90LWFuLWltYWdl" } };

export const AllGrades: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 8 }}>
      {(["A", "B", "C", "D", "F"] as const).map((grade) => (
        <ProjectGlyph key={grade} {...args} grade={grade} logo={null} />
      ))}
    </div>
  ),
};
