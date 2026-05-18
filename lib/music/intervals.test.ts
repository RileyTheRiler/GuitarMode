import { describe, expect, it } from "vitest";
import { intervalName, intervalDirection } from "./intervals";

describe("intervalName", () => {
  it("names the unison correctly", () => {
    expect(intervalName(0)).toBe("P1");
  });

  it("names the perfect fifth correctly", () => {
    expect(intervalName(7)).toBe("P5");
  });

  it("names the major third correctly", () => {
    expect(intervalName(4)).toBe("M3");
  });

  it("names the minor seventh correctly", () => {
    expect(intervalName(10)).toBe("m7");
  });

  it("names the tritone correctly", () => {
    expect(intervalName(6)).toBe("TT");
  });

  it("wraps values >= 12 correctly", () => {
    expect(intervalName(12)).toBe("P1");
    expect(intervalName(19)).toBe("P5");
  });

  it("handles negative semitones via modulo", () => {
    expect(intervalName(-5)).toBe("P5"); // -5 mod 12 = 7
  });
});

describe("intervalDirection", () => {
  it("returns 'up' when to > from", () => {
    expect(intervalDirection(60, 64)).toBe("up");
  });

  it("returns 'down' when to < from", () => {
    expect(intervalDirection(64, 60)).toBe("down");
  });

  it("returns 'unison' when equal", () => {
    expect(intervalDirection(60, 60)).toBe("unison");
  });
});
