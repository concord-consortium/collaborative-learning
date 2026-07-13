import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { SortWorkAddTag } from "./sort-work-add-tag";

const addTag = jest.fn();
let mockStores: any;

jest.mock("../../hooks/use-stores", () => ({
  useStores: () => mockStores
}));

function setup(overrides: any = {}) {
  mockStores = {
    appConfig: { showCommentTag: true, allowCustomCommentTags: true, commentTags: { foo: "Foo" } },
    commentTags: { mergedWith: (c: any) => ({ ...(c ?? {}) }), addTag },
    user: { isTeacher: true, id: "teacher-1" },
    ...overrides
  };
}

describe("SortWorkAddTag", () => {
  beforeEach(() => addTag.mockClear());

  it("renders nothing when the user is not a teacher", () => {
    setup({ user: { isTeacher: false, id: "student-1" } });
    render(<SortWorkAddTag />);
    expect(screen.queryByTestId("sort-work-add-tag")).not.toBeInTheDocument();
  });

  it("renders nothing when custom tags are not allowed", () => {
    setup({ appConfig: { showCommentTag: true, allowCustomCommentTags: false, commentTags: {} } });
    render(<SortWorkAddTag />);
    expect(screen.queryByTestId("sort-work-add-tag")).not.toBeInTheDocument();
  });

  it("lets a teacher add a tag", async () => {
    const user = userEvent.setup();
    setup();
    render(<SortWorkAddTag />);
    await user.click(screen.getByTestId("sort-work-add-tag-button"));
    await user.type(screen.getByTestId("sort-work-add-tag-input"), "X");
    await user.click(screen.getByTestId("sort-work-add-tag-confirm"));
    expect(addTag).toHaveBeenCalledWith("X", "teacher-1");
  });

  it("keeps the entered text and shows an error when the write fails", async () => {
    const user = userEvent.setup();
    setup();
    addTag.mockRejectedValueOnce(new Error("permission denied"));
    render(<SortWorkAddTag />);
    await user.click(screen.getByTestId("sort-work-add-tag-button"));
    await user.type(screen.getByTestId("sort-work-add-tag-input"), "X");
    await user.click(screen.getByTestId("sort-work-add-tag-confirm"));
    // The row stays open with the entered text and surfaces an error so the teacher can retry.
    expect(await screen.findByTestId("sort-work-add-tag-error")).toBeInTheDocument();
    expect(screen.getByTestId("sort-work-add-tag-input")).toHaveValue("X");
  });

  it("disables Add when the entered name matches an existing tag (case-insensitive)", async () => {
    const user = userEvent.setup();
    // Merged tags include the label "Foo"; typing "foo" should be treated as a duplicate.
    setup({ commentTags: { mergedWith: () => ({ foo: "Foo" }), addTag } });
    render(<SortWorkAddTag />);
    await user.click(screen.getByTestId("sort-work-add-tag-button"));
    await user.type(screen.getByTestId("sort-work-add-tag-input"), "foo");
    expect(screen.getByTestId("sort-work-add-tag-confirm")).toBeDisabled();
    expect(screen.getByTestId("sort-work-add-tag-duplicate")).toBeInTheDocument();
    await user.click(screen.getByTestId("sort-work-add-tag-confirm"));
    expect(addTag).not.toHaveBeenCalled();
  });

  it("disables Add when the generated id collides with an existing tag key", async () => {
    const user = userEvent.setup();
    // Existing tag key "diverging" (display "Diverging Designs"). Typing "Diverging" generates the
    // id "diverging", which collides with the key even though the display names differ.
    setup({ commentTags: { mergedWith: () => ({ diverging: "Diverging Designs" }), addTag } });
    render(<SortWorkAddTag />);
    await user.click(screen.getByTestId("sort-work-add-tag-button"));
    await user.type(screen.getByTestId("sort-work-add-tag-input"), "Diverging");
    expect(screen.getByTestId("sort-work-add-tag-confirm")).toBeDisabled();
    await user.click(screen.getByTestId("sort-work-add-tag-confirm"));
    expect(addTag).not.toHaveBeenCalled();
  });
});
