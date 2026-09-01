import { describe, it, expect } from "vitest";
import { describeUpdateError, downloadStatus, formatBytes } from "./AppTab.util";

describe("formatBytes", () => {
  it("keeps small payloads in kilobytes", () => {
    expect(formatBytes(4_096)).toBe("4.1 kB");
  });

  it("switches to megabytes once a payload is big enough to care about", () => {
    expect(formatBytes(12_800_000)).toBe("12.8 MB");
  });

  it("reports a zero-length download as 0 kB rather than NaN", () => {
    expect(formatBytes(0)).toBe("0 kB");
  });
});

describe("downloadStatus", () => {
  it("names both halves once the total is known", () => {
    expect(downloadStatus(4_100_000, 12_800_000)).toBe("Downloading 4.1 MB of 12.8 MB");
  });

  it("reports only what has arrived when the server sent no content length", () => {
    expect(downloadStatus(4_100_000, 0)).toBe("Downloading 4.1 MB…");
  });

  it("says the download is done once every byte is in", () => {
    expect(downloadStatus(12_800_000, 12_800_000)).toBe("Downloaded — installing…");
  });
});

describe("describeUpdateError", () => {
  it("reads a missing latest.json as 'no releases yet', not a failure", () => {
    // What the updater says before the first tag exists: the endpoint 404s and
    // the plugin cannot parse a release manifest out of it.
    const message = describeUpdateError(
      new Error("Could not fetch a valid release JSON, is your updater configured correctly?"),
    );
    expect(message).toMatch(/No published releases yet/);
  });

  it("also reads a bare 404 from the endpoint as 'no releases yet'", () => {
    expect(describeUpdateError("Network Error: status code 404 Not Found")).toMatch(
      /No published releases yet/,
    );
  });

  it("says so plainly when the update server could not be reached", () => {
    expect(describeUpdateError(new Error("error sending request for url"))).toMatch(
      /Couldn't reach the update server/,
    );
  });

  it("passes an unfamiliar failure through rather than inventing a cause", () => {
    expect(describeUpdateError(new Error("signature verification failed"))).toBe(
      "signature verification failed",
    );
  });

  it("has something to say about a thrown non-error", () => {
    expect(describeUpdateError(undefined)).toBe("The update check failed.");
  });
});
