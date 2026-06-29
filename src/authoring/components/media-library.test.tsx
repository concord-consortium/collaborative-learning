import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

import MediaLibrary from "./media-library";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockReloadAllPreviews = jest.fn();

// Stable references — the real hooks return stable values, and refreshUsages depends on `api`
// identity, so a fresh object per render would loop the mount effect.
const mockApi = { get: mockGet, post: mockPost };
const mockPreview = { reloadAllPreviews: mockReloadAllPreviews };

const mockCurriculumValue = {
  files: { "images/old.png": { sha: "abc" } } as Record<string, { sha: string }>,
  branch: "feature-branch",
  unit: "sas",
  unitConfig: undefined,
  teacherGuideConfig: undefined
};

jest.mock("../hooks/use-curriculum", () => ({
  useCurriculum: () => mockCurriculumValue
}));
jest.mock("../hooks/use-authoring-api", () => ({
  useAuthoringApi: () => mockApi
}));
jest.mock("../hooks/use-authoring-preview", () => ({
  useAuthoringPreview: () => mockPreview
}));

describe("MediaLibrary rename flow", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockReloadAllPreviews.mockReset();
    // The library auto-selects the first image and loads its usages on mount.
    mockGet.mockResolvedValue({ success: true, usages: { "images/old.png": [] } });
  });

  const startRename = async (newName: string) => {
    render(<MediaLibrary onClose={jest.fn()} />);
    // Wait for the mount-time usage load to settle before interacting.
    await screen.findByText("Not used in the curriculum");
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    const input = screen.getByLabelText("New image filename") as HTMLInputElement;
    fireEvent.change(input, { target: { value: newName } });
    return input;
  };

  it("shows the confirmation message after a successful rename (not swallowed by selection change)", async () => {
    mockPost.mockResolvedValue({ success: true, updatedFileCount: 2 });
    await startRename("new.png");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Renamed to new.png. Updated 2 references.");
    });
    expect(mockPost).toHaveBeenCalledWith(
      "/renameImage", { branch: "feature-branch", unit: "sas" },
      { fromFileName: "old.png", toFileName: "new.png" });
    // A successful rename re-loads usages; let that settle so no state updates escape the test.
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  });

  it("disables the Save button while a rename request is in flight", async () => {
    let resolvePost: (v: unknown) => void = () => undefined;
    mockPost.mockReturnValue(new Promise(resolve => { resolvePost = resolve; }));
    await startRename("new.png");

    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);
    // In flight: the button is disabled so a second click can't double-submit.
    await waitFor(() => expect(saveButton).toBeDisabled());
    expect(mockPost).toHaveBeenCalledTimes(1);

    resolvePost({ success: true, updatedFileCount: 0 });
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  });

  it("previews the sanitized name when the typed name contains invalid characters", async () => {
    const input = await startRename("file with spaces.jpg");
    // The space-containing name is silently rewritten before submit; show the author the result.
    await waitFor(() => {
      expect(screen.getByText("Will be saved as: file-with-spaces.jpg")).toBeInTheDocument();
    });
    expect(input).toHaveAttribute("aria-describedby", "media-library-rename-preview");
  });

  it("does not show a preview when the typed name needs no sanitizing", async () => {
    await startRename("clean-name.jpg");
    expect(screen.queryByText(/Will be saved as:/)).not.toBeInTheDocument();
  });

  it("surfaces a rename error in an alert region without changing selection", async () => {
    mockPost.mockResolvedValue({ success: false, error: "An image named \"new.png\" already exists." });
    await startRename("new.png");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("already exists");
    });
  });
});
