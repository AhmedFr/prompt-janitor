import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { AppTab, AppTabBody } from "./AppTab";
import { NO_RELEASES, UNREACHABLE, UP_TO_DATE } from "./AppTab.constants";

const getVersion = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/app", () => ({ getVersion }));

const check = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-updater", () => ({ check }));

const relaunch = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch }));

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, isTauri: true };
});

const noop = async () => {};

beforeEach(() => {
  getVersion.mockReset().mockResolvedValue("0.1.0");
  check.mockReset();
  relaunch.mockReset().mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("AppTabBody", () => {
  it("shows the running version", () => {
    render(<AppTabBody version="0.1.0" update={{ kind: "idle" }} check={noop} install={noop} />);
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
  });

  it("falls back to a dash before the runtime has answered", () => {
    render(<AppTabBody version={null} update={{ kind: "idle" }} check={noop} install={noop} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("says the app is current when the check found nothing", () => {
    render(<AppTabBody version="0.1.0" update={{ kind: "current" }} check={noop} install={noop} />);
    expect(screen.getByText(UP_TO_DATE)).toBeInTheDocument();
  });

  it("offers the version and its notes when an update exists", () => {
    render(
      <AppTabBody
        version="0.1.0"
        update={{ kind: "available", version: "0.1.1", notes: "Fixes the tray icon." }}
        check={noop}
        install={noop}
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
        install={noop}
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
        install={noop}
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
        install={noop}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(UNREACHABLE);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <AppTabBody
        version="0.1.0"
        update={{ kind: "available", version: "0.1.1", notes: "Notes." }}
        check={noop}
        install={noop}
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
