/// <reference types="vitest/globals" />
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScaleSuggestions } from "./ScaleSuggestions";
import type { ScaleMatch } from "@/lib/music/detectScale";
import type { ScaleTemplate } from "@/lib/music/scales";

afterEach(cleanup);

const fakeTemplate: ScaleTemplate = {
  name: "Ionian (Major)",
  intervals: [0, 2, 4, 5, 7, 9, 11],
  specificity: 0,
  popularity: 0.15,
};

const fakeMatch: ScaleMatch = {
  root: 0,
  rootName: "C",
  templateName: "Ionian (Major)",
  template: fakeTemplate,
  scale: [0, 2, 4, 5, 7, 9, 11],
  missing: [2, 5, 9],
  score: 1.5,
  confidence: 0.87,
};

describe("ScaleSuggestions", () => {
  it("shows empty-state message when no matches", () => {
    render(
      <ScaleSuggestions
        matches={[]}
        selectedIndex={null}
        onSelect={() => {}}
        detectedCount={0}
      />
    );
    expect(screen.getByText(/scale suggestions appear once you play/i)).toBeTruthy();
  });

  it("renders a scale match with name and confidence", () => {
    render(
      <ScaleSuggestions
        matches={[fakeMatch]}
        selectedIndex={0}
        onSelect={() => {}}
        detectedCount={5}
      />
    );
    expect(screen.getByText("C Ionian (Major)")).toBeTruthy();
    expect(screen.getByText("87%")).toBeTruthy();
  });

  it("calls onSelect when a match is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ScaleSuggestions
        matches={[fakeMatch]}
        selectedIndex={null}
        onSelect={onSelect}
        detectedCount={5}
      />
    );
    fireEvent.click(screen.getByText("C Ionian (Major)"));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it("shows low-confidence warning when detectedCount < 3", () => {
    render(
      <ScaleSuggestions
        matches={[fakeMatch]}
        selectedIndex={null}
        onSelect={() => {}}
        detectedCount={2}
      />
    );
    expect(screen.getByText(/low confidence/i)).toBeTruthy();
  });

  it("shows 'Try next' when notes are missing", () => {
    render(
      <ScaleSuggestions
        matches={[fakeMatch]}
        selectedIndex={0}
        onSelect={() => {}}
        detectedCount={5}
      />
    );
    expect(screen.getByText(/try next/i)).toBeTruthy();
  });
});
