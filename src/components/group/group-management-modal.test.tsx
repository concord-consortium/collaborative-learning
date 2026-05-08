import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Modal from "react-modal";
import { GroupManagementModal } from "./group-management-modal";
import { GroupsModelType } from "../../models/stores/groups";

// Mock student data
const mockStudents = [
  { id: "student-1", fullName: "Alice Smith", type: "student" as const },
  { id: "student-2", fullName: "Bob Jones", type: "student" as const },
  { id: "student-3", fullName: "Carol White", type: "student" as const },
];

const createMockGroup = (id: string, userIds: string[]) => ({
  id,
  users: userIds.map(userId => ({
    id: userId,
    connected: true,
    connectedTimestamp: Date.now(),
  })),
  activeUsers: userIds.map(userId => ({
    id: userId,
    connected: true,
    connectedTimestamp: Date.now(),
  })),
  getUserById: (uid: string) => {
    const foundUser = userIds.find(userId => userId === uid);
    return foundUser ? { id: foundUser, connected: true } : undefined;
  },
});

const mockGroup1 = createMockGroup("1", ["student-1", "student-2"]);
const mockGroup2 = createMockGroup("2", ["student-3"]);

const mockGroups: Partial<GroupsModelType> = {
  allGroups: [mockGroup1, mockGroup2] as any,
  groupForUser: jest.fn((uid: string) => {
    if (uid === "student-1" || uid === "student-2") return mockGroup1 as any;
    if (uid === "student-3") return mockGroup2 as any;
    return undefined;
  }),
  getGroupById: jest.fn((id: string) => {
    if (id === "1") return mockGroup1 as any;
    if (id === "2") return mockGroup2 as any;
    return undefined;
  }),
};

jest.mock("../../hooks/use-stores", () => ({
  useStores: () => ({
    groups: mockGroups,
    class: { students: mockStudents },
    user: { id: "student-1", currentGroupId: "1" },
    db: {
      moveStudentToGroup: jest.fn().mockResolvedValue(undefined),
      createEmptyGroup: jest.fn().mockResolvedValue(undefined),
    },
    isShowingTeacherContent: false,
  }),
}));

describe("GroupManagementModal accessibility", () => {
  beforeEach(() => {
    const appDiv = document.createElement("div");
    appDiv.className = "app";
    document.body.appendChild(appDiv);
    Modal.setAppElement(".app");
  });

  afterEach(() => {
    const appDiv = document.querySelector(".app");
    if (appDiv) document.body.removeChild(appDiv);
  });

  const renderModal = (props: Partial<React.ComponentProps<typeof GroupManagementModal>> = {}) => {
    return render(
      <GroupManagementModal
        isOpen={true}
        mode="student"
        onClose={jest.fn()}
        {...props}
      />
    );
  };

  it("has role=dialog with aria-labelledby and aria-modal", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toMatch(/^group-management-modal-title-\d+$/);

    const title = document.getElementById(labelledBy!);
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent(/join a different group/i);
  });

  it("close button has accessible label", () => {
    renderModal({ allowCancel: true });
    const closeButton = screen.getByTestId("group-management-modal-close-button");
    expect(closeButton).toHaveAttribute("aria-label", "Close");
  });

  it("group cards have role=button and are tabbable", () => {
    renderModal();
    const group1 = screen.getByTestId("group-card-1");
    expect(group1).toHaveAttribute("role", "button");
    expect(group1).toHaveAttribute("tabindex", "0");

    const group2 = screen.getByTestId("group-card-2");
    expect(group2).toHaveAttribute("role", "button");
    expect(group2).toHaveAttribute("tabindex", "0");
  });

  it("Escape closes the modal when allowCancel is true", async () => {
    const onClose = jest.fn();
    renderModal({ allowCancel: true, onClose });
    const groupCard = screen.getByTestId("group-card-1");
    await waitFor(() => {
      expect(document.activeElement).toBe(groupCard);
    });

    // Use fireEvent with an explicit keyCode: react-modal v3 checks event.keyCode === 27,
    // but @testing-library/user-event v14 dispatches KeyboardEvents without setting keyCode.
    fireEvent.keyDown(groupCard, { key: "Escape", code: "Escape", keyCode: 27 });
    expect(onClose).toHaveBeenCalled();
  });

  it("Escape does not close the modal when allowCancel is false", async () => {
    const onClose = jest.fn();
    renderModal({ allowCancel: false, onClose });
    const groupCard = screen.getByTestId("group-card-1");
    await waitFor(() => {
      expect(document.activeElement).toBe(groupCard);
    });

    fireEvent.keyDown(groupCard, { key: "Escape", code: "Escape", keyCode: 27 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("close button is not rendered when allowCancel is false", () => {
    renderModal({ allowCancel: false });
    expect(screen.queryByTestId("group-management-modal-close-button")).not.toBeInTheDocument();
  });

  it("interactive elements are tabbable within the modal", () => {
    renderModal({ allowCancel: true });

    // Close button
    const closeButton = screen.getByTestId("group-management-modal-close-button");
    expect(closeButton.tagName).toBe("BUTTON");

    // Group cards are tabbable
    const group1 = screen.getByTestId("group-card-1");
    expect(group1).toHaveAttribute("tabindex", "0");
    const group2 = screen.getByTestId("group-card-2");
    expect(group2).toHaveAttribute("tabindex", "0");

    // Checkbox is tabbable (native input)
    const checkbox = screen.getByTestId("group-management-modal-sort-checkbox");
    expect(checkbox.tagName).toBe("INPUT");

    // Cancel and Save buttons
    const cancelButton = screen.getByTestId("group-management-modal-cancel-button");
    expect(cancelButton.tagName).toBe("BUTTON");
    const saveButton = screen.getByTestId("group-management-modal-save-button");
    expect(saveButton.tagName).toBe("BUTTON");
  });

  it("error message is not shown initially", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("auto-focuses current user's group card on open with keyboard-focused class", async () => {
    renderModal();
    const groupCard = screen.getByTestId("group-card-1");
    // onAfterOpen may fire asynchronously — wait for focus to land on the group card
    await waitFor(() => {
      expect(document.activeElement).toBe(groupCard);
    });
    expect(groupCard).toHaveClass("keyboard-focused");
  });
});
