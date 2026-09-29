import type { Meta, StoryObj } from "@storybook/react";
import { NavigationContext } from "@/App/navigation/NavigationContext";
import type { Navigation } from "@/App/navigation/navigation.types";
import { BackButton } from "./BackButton";

const noop = () => {};
const nav = (canGoBack: boolean): Navigation => ({
  state: { route: "setup", target: {} },
  canGoBack,
  navigate: noop,
  push: noop,
  replace: noop,
  back: noop,
  closeItem: noop,
  registerBackGuard: () => noop,
});

const meta = {
  title: "Components/BackButton",
  component: BackButton,
} satisfies Meta<typeof BackButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Somewhere to go back to: the arrow is drawn. */
export const CanGoBack: Story = {
  decorators: [
    (Story) => (
      <NavigationContext.Provider value={nav(true)}>
        <Story />
      </NavigationContext.Provider>
    ),
  ],
};

/** The start of history: nothing is drawn. */
export const AtStart: Story = {
  decorators: [
    (Story) => (
      <NavigationContext.Provider value={nav(false)}>
        <Story />
      </NavigationContext.Provider>
    ),
  ],
};
