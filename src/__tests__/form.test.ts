import { describe, it, expect } from "vitest";
import { createForm } from "../components/form.js";

describe("form — draft player names", () => {
  it("starts with 2 empty rows when no initial names provided", () => {
    const form = createForm(() => {});
    const rawNames = form.getRawNames();
    expect(rawNames).toHaveLength(2);
    expect(rawNames[0]).toBe("");
    expect(rawNames[1]).toBe("");
  });

  it("prepopulates inputs from initialNames", () => {
    const form = createForm(() => {}, ["Alice", "Bob", "Charlie"]);
    const rawNames = form.getRawNames();
    expect(rawNames).toHaveLength(3);
    expect(rawNames[0]).toBe("Alice");
    expect(rawNames[1]).toBe("Bob");
    expect(rawNames[2]).toBe("Charlie");
  });

  it("preserves empty rows in getRawNames", () => {
    const form = createForm(() => {}, ["Alice", "", "Charlie"]);
    const rawNames = form.getRawNames();
    expect(rawNames).toHaveLength(3);
    expect(rawNames[0]).toBe("Alice");
    expect(rawNames[1]).toBe("");
    expect(rawNames[2]).toBe("Charlie");
  });

  it("getPlayers excludes empty names", () => {
    const form = createForm(() => {}, ["Alice", "", "Charlie"]);
    const players = form.getPlayers();
    expect(players).toHaveLength(2);
    expect(players[0].name).toBe("Alice");
    expect(players[1].name).toBe("Charlie");
  });

  it("two forms created from same names are independent", () => {
    const names = ["Alice", "Bob"];
    const form1 = createForm(() => {}, names);
    const form2 = createForm(() => {}, []);

    expect(form1.getRawNames()).toEqual(["Alice", "Bob"]);
    expect(form2.getRawNames()).toEqual(["", ""]);
  });
});
