import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { AppTab, AppTabBody } from "./AppTab";
import {
  NO_RELEASES,
  RESET_CONFIRM,
  UNINSTALL_CONFIRM,
  UNREACHABLE,
  UP_TO_DATE,
} from "./AppTab.constants";

const getVersion = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/app", () => ({ getVersion }));

const check = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-updater", () => ({ check }));

const relaunch = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch }));

const ask = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask }));

const resetAppData = vi.hoisted(() => vi.fn());
const uninstallApp = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, isTauri: true, commands: { resetAppData, uninstallApp } };
});

const noop = async () => {};

/** The half of the body's props this suite is not exercising. */
const quiet = {
  danger: "" as const,
  dangerResult: null,
  reset: noop,
  uninstall: noop,
};

beforeEach(() => {
  getVersion.mockReset().mockResolvedValue("0.1.0");
  check.mockReset();
  relaunch.mockReset().mockResolvedValue(undefined);
  ask.mockReset();
  resetAppData.mockReset().mockResolvedValue({ status: "ok", data: "Deleted 2 local files." });
  uninstallApp.mockReset().mockResolvedValue({ status: "ok", data: "Removed 2 local files." });
});

afterEach(cleanup);

describe("AppTabBody", () => {
  it("shows the running version", () => {
    render(<AppTabBody version="0.1.0" update={{ kind: "idle" }} check={noop} install={noop} {...quiet} />);
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
  });

  it("falls back to a dash before the runtime has answered", () => {
    render(<AppTabBody version={null} update={{ kind: "idle" }} check={noop} install={noop} {...quiet} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("says the app is current when the check found nothing", () => {
    render(<AppTabBody version="0.1.0" update={{ kind: "current" }} check={noop} install={noop} {...quiet} />);
    expect(screen.getByText(UP_TO_DATE)).toBeInTheDocument();
  });

  it("offers the version and its notes when an update exists", () => {
    render(
      <AppTabBody
        version="0.1.0"
        update={{ kind: "available", version: "0.1.1", notes: "Fixes the tray icon." }}
        check={noop}
        install={noop} {...quiet}
      />,
    );
    expect(screen.getByText("Version 0.1.1 is available")).toBeInTheDocument();
    expect(screen.getByText("Fixes the tray icon.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Install & relaunch/ })).toBeEnabled();
  });

  it("draws a labelled progress bar while the download runs", () => {
    render(
      <AppTabBody
        version="0.1.0"
        update={{ kind: "downloading", version: "0.1.1", downloaded: 4_100_000, total: 12_800_000 }}
        check={noop}
        install={noop} {...quiet}
      />,
    );
    const bar = screen.getByRole("progressbar", { name: "Update download progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "32");
    expect(screen.getByText("Downloading 4.1 MB of 12.8 MB")).toBeInTheDocument();
  });

  it("keeps the check button out of reach while work is in flight", () => {
    render(
      <AppTabBody
        version="0.1.0"
        update={{ kind: "checking" }}
        check={noop}
        install={noop} {...quiet}
      />,
    );
    expect(screen.getByRole("button", { name: /Checking…/ })).toBeDisabled();
  });

  it("shows a failure inline as an alert", () => {
    render(
      <AppTabBody
        version="0.1.0"
        update={{ kind: "error", message: UNREACHABLE }}
        check={noop}
        install={noop} {...quiet}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(UNREACHABLE);
  });

  it("keeps both destructive actions out of reach while one is running", () => {
    render(
      <AppTabBody
        version="0.1.0"
        update={{ kind: "idle" }}
        check={noop}
        install={noop}
        danger="reset"
        dangerResult={null}
        reset={noop}
        uninstall={noop}
      />,
    );
    expect(screen.getByRole("button", { name: /Resetting…/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Uninstall Prompt Janitor…/ })).toBeDisabled();
  });

  it("says out loud that neither action touches the user's prompt files", () => {
    render(
      <AppTabBody version="0.1.0" update={{ kind: "idle" }} check={noop} install={noop} {...quiet} />,
    );
    expect(screen.getByText(/never touches|only ever reads them where they live/)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <AppTabBody
        version="0.1.0"
        update={{ kind: "available", version: "0.1.1", notes: "Notes." }}
        check={noop}
        install={noop} {...quiet}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations reporting a destructive failure", async () => {
    const { container } = render(
      <AppTabBody
        version="0.1.0"
        update={{ kind: "idle" }}
        check={noop}
        install={noop}
        danger=""
        dangerResult={{ ok: false, message: "database is locked" }}
        reset={noop}
        uninstall={noop}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("AppTab", () => {
  it("reads the running version from the runtime", async () => {
    check.mockResolvedValue(null);
    render(<AppTab />);
    expect(await screen.findByText("0.1.0")).toBeInTheDocument();
  });

  it("reports 'up to date' when the endpoint has nothing newer", async () => {
    check.mockResolvedValue(null);
    render(<AppTab />);
    fireEvent.click(screen.getByRole("button", { name: /Check for updates/ }));
    expect(await screen.findByText(UP_TO_DATE)).toBeInTheDocument();
  });

  it("reads 'no release yet' as news, not as a scary error", async () => {
    check.mockRejectedValue(new Error("Could not fetch a valid release JSON"));
    render(<AppTab />);
    fireEvent.click(screen.getByRole("button", { name: /Check for updates/ }));
    expect(await screen.findByText(NO_RELEASES)).toBeInTheDocument();
  });

  it("says so when the update server is unreachable", async () => {
    check.mockRejectedValue(new Error("error sending request for url"));
    render(<AppTab />);
    fireEvent.click(screen.getByRole("button", { name: /Check for updates/ }));
    expect(await screen.findByText(UNREACHABLE)).toBeInTheDocument();
  });

  it("downloads with progress and relaunches into the new build", async () => {
    const downloadAndInstall = vi.fn(
      async (onEvent: (e: Record<string, unknown>) => void) => {
        onEvent({ event: "Started", data: { contentLength: 1_000_000 } });
        onEvent({ event: "Progress", data: { chunkLength: 400_000 } });
        onEvent({ event: "Finished", data: {} });
      },
    );
    check.mockResolvedValue({ version: "0.1.1", body: "Notes.", downloadAndInstall });

    render(<AppTab />);
    fireEvent.click(screen.getByRole("button", { name: /Check for updates/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Install & relaunch/ }));

    await waitFor(() => expect(relaunch).toHaveBeenCalledTimes(1));
    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the reset confirmation is declined", async () => {
    check.mockResolvedValue(null);
    ask.mockResolvedValue(false);
    render(<AppTab />);
    fireEvent.click(screen.getByRole("button", { name: /Reset app data…/ }));
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
    expect(resetAppData).not.toHaveBeenCalled();
  });

  it("spells out what a reset deletes and what survives it", async () => {
    check.mockResolvedValue(null);
    ask.mockResolvedValue(false);
    render(<AppTab />);
    fireEvent.click(screen.getByRole("button", { name: /Reset app data…/ }));
    await waitFor(() => expect(ask).toHaveBeenCalledWith(RESET_CONFIRM, expect.anything()));
  });

  it("resets and reports what went once confirmed", async () => {
    check.mockResolvedValue(null);
    ask.mockResolvedValue(true);
    render(<AppTab />);
    fireEvent.click(screen.getByRole("button", { name: /Reset app data…/ }));
    expect(await screen.findByText("Deleted 2 local files.")).toBeInTheDocument();
    expect(resetAppData).toHaveBeenCalledTimes(1);
  });

  it("shows a failed reset inline rather than swallowing it", async () => {
    check.mockResolvedValue(null);
    ask.mockResolvedValue(true);
    resetAppData.mockResolvedValue({ status: "error", error: "database is locked" });
    render(<AppTab />);
    fireEvent.click(screen.getByRole("button", { name: /Reset app data…/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("database is locked");
  });

  it("does nothing when the uninstall confirmation is declined", async () => {
    check.mockResolvedValue(null);
    ask.mockResolvedValue(false);
    render(<AppTab />);
    fireEvent.click(screen.getByRole("button", { name: /Uninstall Prompt Janitor…/ }));
    await waitFor(() => expect(ask).toHaveBeenCalledWith(UNINSTALL_CONFIRM, expect.anything()));
    expect(uninstallApp).not.toHaveBeenCalled();
  });

  it("uninstalls once confirmed and reports what happened", async () => {
    check.mockResolvedValue(null);
    ask.mockResolvedValue(true);
    uninstallApp.mockResolvedValue({
      status: "ok",
      data: "Removed 2 local files. This is a development build, so there is no app bundle to move to the Trash.",
    });
    render(<AppTab />);
    fireEvent.click(screen.getByRole("button", { name: /Uninstall Prompt Janitor…/ }));
    expect(await screen.findByText(/development build/)).toBeInTheDocument();
    expect(uninstallApp).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed download instead of pretending it relaunched", async () => {
    check.mockResolvedValue({
      version: "0.1.1",
      body: null,
      downloadAndInstall: vi.fn().mockRejectedValue(new Error("signature verification failed")),
    });

    render(<AppTab />);
    fireEvent.click(screen.getByRole("button", { name: /Check for updates/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Install & relaunch/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("signature verification failed");
    expect(relaunch).not.toHaveBeenCalled();
  });
});
