import { describe, it, expect, beforeEach, vi } from "vitest";
import { canInstall, isInstalled, promptInstall, savedForOffline } from "../hub/install.js";
import { renderAccount } from "../hub/views/account.js";

/**
 * The offline promise, and the install that makes it stick.
 *
 * Everything else in the hub can be checked by a coach on the spot. Whether it
 * will still work at a pitch with no signal cannot, until the moment it matters
 * and it is too late. So the app says so, and these hold it to saying the right
 * one of the two things.
 */

/** A `beforeinstallprompt`, which no test environment fires on its own. */
function offerInstall(outcome: "accepted" | "dismissed" = "accepted") {
  const prompt = vi.fn(() => Promise.resolve());
  const event = Object.assign(new Event("beforeinstallprompt"), {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  });
  window.dispatchEvent(event);
  return prompt;
}

function withController(present: boolean): void {
  Object.defineProperty(navigator, "serviceWorker", {
    value: present ? { controller: {} } : undefined,
    configurable: true,
  });
}

describe("what this device has", () => {
  beforeEach(() => {
    withController(false);
  });

  it("is honest that nothing is saved before the worker is serving the page", () => {
    expect(savedForOffline()).toBe(false);
  });

  it("says so once the worker is between the app and the network", () => {
    withController(true);
    expect(savedForOffline()).toBe(true);
  });

  it("does not claim to be installed inside a browser tab", () => {
    expect(isInstalled()).toBe(false);
  });
});

describe("the install offer", () => {
  it("is absent until the browser makes one", async () => {
    expect(canInstall()).toBe(false);
    expect(await promptInstall()).toBe("unavailable");
  });

  it("is taken up once, then spent whatever the coach chose", async () => {
    const prompt = offerInstall("accepted");
    expect(canInstall()).toBe(true);

    expect(await promptInstall()).toBe("installed");
    expect(prompt).toHaveBeenCalledOnce();

    // A prompt cannot be shown twice, so nothing is left to offer
    expect(canInstall()).toBe(false);
    expect(await promptInstall()).toBe("unavailable");
  });

  it("is still there when the browser refused to show it", async () => {
    // Chrome rejects the call when it declines to display anything. The offer
    // was being dropped before that, taking the button away for the rest of the
    // visit over a prompt nobody ever saw.
    const event = Object.assign(new Event("beforeinstallprompt"), {
      prompt: () => Promise.reject(new Error("not now")),
      userChoice: Promise.resolve({ outcome: "dismissed" as const }),
    });
    window.dispatchEvent(event);

    expect(await promptInstall()).toBe("unavailable");
    expect(canInstall()).toBe(true);
  });

  it("is also spent when the coach says no", async () => {
    offerInstall("dismissed");
    expect(await promptInstall()).toBe("dismissed");
    expect(canInstall()).toBe(false);
  });

  it("goes away again when the app is installed some other way", () => {
    offerInstall();
    expect(canInstall()).toBe(true);
    window.dispatchEvent(new Event("appinstalled"));
    expect(canInstall()).toBe(false);
  });
});

describe("the account page says which state the device is in", () => {
  let container: HTMLElement;

  const panel = (): string =>
    [...container.querySelectorAll("section")]
      .find((section) => section.querySelector("h2")?.textContent === "On this device")
      ?.textContent ?? "";

  beforeEach(() => {
    container = document.createElement("div");
    document.body.replaceChildren(container);
    withController(false);
  });

  const draw = (): void =>
    renderAccount(container, { name: "Coach", club: "A club", ageGroup: "u10" }, "c@example.com");

  it("does not promise offline before it is true", () => {
    draw();
    expect(panel()).toContain("Not saved for offline yet");
    expect(panel()).not.toContain("Ready for the pitch");
  });

  it("says it plainly once it is", () => {
    withController(true);
    draw();
    expect(panel()).toContain("Ready for the pitch");
  });

  it("tells a coach where their own browser keeps it when there is no button", () => {
    draw();
    expect(container.querySelector("#install-app")).toBeNull();
    // iPhone is most of this audience and never fires the event at all, so the
    // way in has to be written down rather than left to a button that is absent
    expect(panel()).toContain("Add to Home Screen");
  });

  it("offers the button when the browser has one to give", () => {
    offerInstall();
    draw();
    expect(container.querySelector("#install-app")).not.toBeNull();
  });

  it("stops explaining how to install once it is installed", async () => {
    offerInstall("accepted");
    draw();
    const button = container.querySelector<HTMLButtonElement>("#install-app");
    if (!button) throw new Error("no install button");

    button.click();
    // The prompt and the choice are two awaits deep
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(panel()).toContain("Added");
    // The copy around the button used to survive it, so a coach was told it had
    // been added and then told how to add it
    expect(panel()).not.toContain("Add to Home Screen");
    expect(container.querySelector("#install-app")).toBeNull();
  });
});
