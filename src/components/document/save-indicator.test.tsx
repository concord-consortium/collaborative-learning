import React from "react";
import { render, screen, act } from "@testing-library/react";
import { SaveIndicator } from "./save-indicator";
import { createDocumentModel } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";

// This is needed so MST can deserialize snapshots referring to tools
import { registerTileTypes } from "../../register-tile-types";
registerTileTypes(["Text"]);

jest.mock("../../assets/icons/cloud-check.svg", () => () => <svg data-testid="cloud-check-icon" />);
jest.mock("../../assets/icons/sync-arrows.svg", () => () => <svg data-testid="sync-arrows-icon" />);

function createTestDoc() {
  return createDocumentModel({
    type: ProblemDocument,
    key: "test-doc",
    uid: "user-1",
    createdAt: Date.now(),
    content: {},
  });
}

describe("SaveIndicator", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows nothing when idle", () => {
    const doc = createTestDoc();
    render(<SaveIndicator document={doc} />);
    const indicator = screen.getByTestId("save-indicator");
    expect(indicator).not.toHaveTextContent("Saving");
    expect(indicator).not.toHaveTextContent("Saved");
  });

  it("shows 'Saving...' when saving", () => {
    const doc = createTestDoc();
    render(<SaveIndicator document={doc} />);
    act(() => { doc.setSaveState("saving"); });
    expect(screen.getByTestId("save-indicator")).toHaveTextContent("Saving...");
  });

  it("shows 'Saved' when saved, then hides after timeout", () => {
    const doc = createTestDoc();
    render(<SaveIndicator document={doc} />);
    act(() => { doc.setSaveState("saved"); });
    expect(screen.getByTestId("save-indicator")).toHaveTextContent("Saved");

    act(() => { jest.advanceTimersByTime(3000); });
    expect(screen.getByTestId("save-indicator")).not.toHaveTextContent("Saved");
  });

  it("shows 'Retrying...' when retrying", () => {
    const doc = createTestDoc();
    render(<SaveIndicator document={doc} />);
    act(() => { doc.setSaveState("retrying"); });
    expect(screen.getByTestId("save-indicator")).toHaveTextContent("Retrying...");
  });

  it("cancels saved timeout when new save starts", () => {
    const doc = createTestDoc();
    render(<SaveIndicator document={doc} />);
    act(() => { doc.setSaveState("saved"); });
    expect(screen.getByTestId("save-indicator")).toHaveTextContent("Saved");

    // New change before timeout fires
    act(() => { doc.setSaveState("saving"); });
    expect(screen.getByTestId("save-indicator")).toHaveTextContent("Saving...");

    // Original timeout fires — should NOT revert to idle since we're saving
    act(() => { jest.advanceTimersByTime(3000); });
    expect(screen.getByTestId("save-indicator")).toHaveTextContent("Saving...");
  });
});
