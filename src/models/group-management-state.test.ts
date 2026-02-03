import { GroupManagementState } from "./group-management-state";
import { GroupsModelType } from "./stores/groups";
import { ClassModelType } from "./stores/class";
import { UserModelType } from "./stores/user";
import { DB } from "../lib/db";

// Mock student data
const mockStudents = [
  { id: "student-1", fullName: "Alice Smith", type: "student" as const },
  { id: "student-2", fullName: "Bob Jones", type: "student" as const },
  { id: "student-3", fullName: "Carol White", type: "student" as const },
  { id: "student-4", fullName: "David Brown", type: "student" as const },
];

// Mock group data
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

describe("GroupManagementState", () => {
  let state: GroupManagementState;
  let mockGroups: Partial<GroupsModelType>;
  let mockClassStore: Partial<ClassModelType>;
  let mockUser: Partial<UserModelType>;
  let mockDb: Partial<DB>;

  const mockGroup1 = createMockGroup("1", ["student-1", "student-2"]);
  const mockGroup2 = createMockGroup("2", ["student-3"]);

  beforeEach(() => {
    mockGroups = {
      allGroups: [mockGroup1, mockGroup2] as any,
      groupForUser: jest.fn((uid: string) => {
        if (uid === "student-1" || uid === "student-2") return mockGroup1 as any;
        if (uid === "student-3") return mockGroup2 as any;
        return undefined;
      }),
    };

    mockClassStore = {
      students: mockStudents as any,
    };

    mockUser = {
      id: "teacher-1",
    };

    mockDb = {
      moveStudentToGroup: jest.fn().mockResolvedValue(undefined),
      createEmptyGroup: jest.fn().mockResolvedValue(undefined),
    };
  });

  const createState = (mode: "teacher" | "student" | "researcher" = "teacher") => {
    return new GroupManagementState(
      mockGroups as GroupsModelType,
      mockClassStore as ClassModelType,
      mockUser as UserModelType,
      mockDb as DB,
      mode
    );
  };

  describe("constructor and initial state", () => {
    it("should initialize with default values", () => {
      state = createState();

      expect(state.pendingMoves.size).toBe(0);
      expect(state.selectedStudentId).toBeNull();
      expect(state.selectedGroupId).toBeNull();
      expect(state.createdGroupsInSession.size).toBe(0);
      expect(state.showLastNameFirst).toBe(false);
      expect(state.isSaving).toBe(false);
      expect(state.draggingStudentId).toBeNull();
      expect(state.draggingStudentName).toBeNull();
      expect(state.draggingStudentConnected).toBe(false);
    });

    it("should store the mode correctly", () => {
      state = createState("teacher");
      expect(state.mode).toBe("teacher");

      state = createState("student");
      expect(state.mode).toBe("student");

      state = createState("researcher");
      expect(state.mode).toBe("researcher");
    });
  });

  describe("computed: isTeacherMode", () => {
    it("should return true for teacher mode", () => {
      state = createState("teacher");
      expect(state.isTeacherMode).toBe(true);
    });

    it("should return true for researcher mode", () => {
      state = createState("researcher");
      expect(state.isTeacherMode).toBe(true);
    });

    it("should return false for student mode", () => {
      state = createState("student");
      expect(state.isTeacherMode).toBe(false);
    });
  });

  describe("computed: existingGroupIds", () => {
    it("should return set of existing group IDs", () => {
      state = createState();
      const ids = state.existingGroupIds;

      expect(ids.has("1")).toBe(true);
      expect(ids.has("2")).toBe(true);
      expect(ids.has("3")).toBe(false);
    });
  });

  describe("computed: studentGroupMap", () => {
    it("should map students to their current groups", () => {
      state = createState("teacher");
      const map = state.studentGroupMap;

      expect(map.get("student-1")).toBe("1");
      expect(map.get("student-2")).toBe("1");
      expect(map.get("student-3")).toBe("2");
      expect(map.get("student-4")).toBeNull();
    });

    it("should include pending moves in teacher mode", () => {
      state = createState("teacher");
      state.selectedStudentId = "student-1";
      state.selectGroup("2");

      const map = state.studentGroupMap;
      expect(map.get("student-1")).toBe("2");
    });

    it("should include selected group for current user in student mode", () => {
      mockUser.id = "student-4";
      state = createState("student");
      state.selectedGroupId = "1";

      const map = state.studentGroupMap;
      expect(map.get("student-4")).toBe("1");
    });
  });

  describe("computed: newGroupIds", () => {
    it("should return empty array when no new groups", () => {
      state = createState();
      expect(state.newGroupIds).toEqual([]);
    });

    it("should include groups from pending moves that don't exist", () => {
      state = createState("teacher");
      state.selectedStudentId = "student-1";
      state.selectGroup("3"); // Group 3 doesn't exist

      expect(state.newGroupIds).toContain("3");
    });

    it("should include groups created in session", () => {
      state = createState();
      state.createdGroupsInSession = new Set(["5", "6"]);

      expect(state.newGroupIds).toContain("5");
      expect(state.newGroupIds).toContain("6");
    });

    it("should sort numerically", () => {
      state = createState();
      state.createdGroupsInSession = new Set(["10", "3", "5"]);

      expect(state.newGroupIds).toEqual(["3", "5", "10"]);
    });
  });

  describe("computed: nextGroupId", () => {
    it("should return the next available numeric ID", () => {
      state = createState();
      // Existing groups are 1 and 2
      expect(state.nextGroupId).toBe("3");
    });

    it("should account for new groups in session", () => {
      state = createState();
      state.createdGroupsInSession = new Set(["3", "4"]);

      expect(state.nextGroupId).toBe("5");
    });
  });

  describe("computed: currentUserGroupId", () => {
    it("should return the current user's group ID", () => {
      mockUser.id = "student-1";
      state = createState("student");

      expect(state.currentUserGroupId).toBe("1");
    });

    it("should return null if user has no group", () => {
      mockUser.id = "student-4";
      state = createState("student");

      expect(state.currentUserGroupId).toBeNull();
    });
  });

  describe("computed: isFirstTimeJoin", () => {
    it("should return true for student with no group", () => {
      mockUser.id = "student-4";
      state = createState("student");

      expect(state.isFirstTimeJoin).toBe(true);
    });

    it("should return false for student with a group", () => {
      mockUser.id = "student-1";
      state = createState("student");

      expect(state.isFirstTimeJoin).toBe(false);
    });

    it("should return false for teacher mode", () => {
      mockUser.id = "student-4";
      state = createState("teacher");

      expect(state.isFirstTimeJoin).toBe(false);
    });
  });

  describe("computed: effectiveSelectedStudentId", () => {
    it("should return selected student in teacher mode", () => {
      state = createState("teacher");
      state.selectedStudentId = "student-1";

      expect(state.effectiveSelectedStudentId).toBe("student-1");
    });

    it("should return current user ID in student mode", () => {
      mockUser.id = "student-3";
      state = createState("student");

      expect(state.effectiveSelectedStudentId).toBe("student-3");
    });
  });

  describe("computed: hasChanges", () => {
    it("should return false when no changes in teacher mode", () => {
      state = createState("teacher");
      expect(state.hasChanges).toBe(false);
    });

    it("should return true when pending moves exist in teacher mode", () => {
      state = createState("teacher");
      state.selectedStudentId = "student-1";
      state.selectGroup("2");

      expect(state.hasChanges).toBe(true);
    });

    it("should return false when no group selected in student mode", () => {
      mockUser.id = "student-4";
      state = createState("student");

      expect(state.hasChanges).toBe(false);
    });

    it("should return true when different group selected in student mode", () => {
      mockUser.id = "student-1";
      state = createState("student");
      state.selectedGroupId = "2";

      expect(state.hasChanges).toBe(true);
    });

    it("should return false when same group selected in student mode", () => {
      mockUser.id = "student-1";
      state = createState("student");
      state.selectedGroupId = "1";

      expect(state.hasChanges).toBe(false);
    });
  });

  describe("computed: modalTitle", () => {
    it("should return teacher title in teacher mode", () => {
      state = createState("teacher");
      expect(state.modalTitle).toBe("Move Students to Different Groups");
    });

    it("should return join title for first-time student", () => {
      mockUser.id = "student-4";
      state = createState("student");
      expect(state.modalTitle).toBe("Join Group");
    });

    it("should return change group title for student with existing group", () => {
      mockUser.id = "student-1";
      state = createState("student");
      expect(state.modalTitle).toBe("Join a Different Group");
    });
  });

  describe("computed: unassignedStudents", () => {
    it("should return students not in any group", () => {
      state = createState();
      const unassigned = state.unassignedStudents;

      expect(unassigned.length).toBe(1);
      expect(unassigned[0].id).toBe("student-4");
    });
  });

  describe("action: reset", () => {
    it("should reset all state to initial values", () => {
      state = createState("teacher");
      state.selectedStudentId = "student-1";
      state.selectGroup("2");
      state.showLastNameFirst = true;
      state.draggingStudentId = "student-2";

      state.reset();

      expect(state.pendingMoves.size).toBe(0);
      expect(state.selectedStudentId).toBeNull();
      expect(state.selectedGroupId).toBeNull();
      expect(state.createdGroupsInSession.size).toBe(0);
      expect(state.draggingStudentId).toBeNull();
      expect(state.draggingStudentName).toBeNull();
      expect(state.draggingStudentConnected).toBe(false);
      // showLastNameFirst is NOT reset
      expect(state.showLastNameFirst).toBe(true);
    });
  });

  describe("action: selectStudent", () => {
    it("should select a student in teacher mode", () => {
      state = createState("teacher");
      state.selectStudent("student-1");

      expect(state.selectedStudentId).toBe("student-1");
    });

    it("should toggle selection when selecting same student", () => {
      state = createState("teacher");
      state.selectStudent("student-1");
      state.selectStudent("student-1");

      expect(state.selectedStudentId).toBeNull();
    });

    it("should not select in student mode", () => {
      state = createState("student");
      state.selectStudent("student-1");

      expect(state.selectedStudentId).toBeNull();
    });
  });

  describe("action: selectGroup", () => {
    describe("in teacher mode", () => {
      it("should add pending move when student is selected", () => {
        state = createState("teacher");
        state.selectedStudentId = "student-1";
        state.selectGroup("2");

        expect(state.pendingMoves.get("student-1")).toBe("2");
        expect(state.selectedStudentId).toBeNull();
      });

      it("should not add move when no student selected", () => {
        state = createState("teacher");
        state.selectGroup("2");

        expect(state.pendingMoves.size).toBe(0);
      });

      it("should not add move to same group", () => {
        state = createState("teacher");
        state.selectedStudentId = "student-1";
        state.selectGroup("1"); // student-1 is already in group 1

        expect(state.pendingMoves.size).toBe(0);
      });

      it("should track new group creation", () => {
        state = createState("teacher");
        state.selectedStudentId = "student-1";
        state.selectGroup("5"); // New group

        expect(state.createdGroupsInSession.has("5")).toBe(true);
      });
    });

    describe("in student mode", () => {
      it("should set selected group", () => {
        mockUser.id = "student-4";
        state = createState("student");
        state.selectGroup("1");

        expect(state.selectedGroupId).toBe("1");
      });

      it("should track new group creation", () => {
        mockUser.id = "student-4";
        state = createState("student");
        state.selectGroup("5"); // New group

        expect(state.createdGroupsInSession.has("5")).toBe(true);
      });
    });
  });

  describe("action: moveStudentToNoGroup", () => {
    it("should add pending move to null in teacher mode", () => {
      state = createState("teacher");
      state.selectedStudentId = "student-1";
      state.moveStudentToNoGroup();

      expect(state.pendingMoves.get("student-1")).toBeNull();
      expect(state.selectedStudentId).toBeNull();
    });

    it("should do nothing when no student selected", () => {
      state = createState("teacher");
      state.moveStudentToNoGroup();

      expect(state.pendingMoves.size).toBe(0);
    });

    it("should do nothing in student mode", () => {
      state = createState("student");
      state.selectedStudentId = "student-1";
      state.moveStudentToNoGroup();

      expect(state.pendingMoves.size).toBe(0);
    });
  });

  describe("action: startDrag", () => {
    it("should set drag state", () => {
      state = createState("teacher");
      state.startDrag("student-1", "Alice Smith");

      expect(state.draggingStudentId).toBe("student-1");
      expect(state.draggingStudentName).toBe("Alice Smith");
      expect(state.draggingStudentConnected).toBe(true);
    });

    it("should select student in teacher mode", () => {
      state = createState("teacher");
      state.startDrag("student-1", "Alice Smith");

      expect(state.selectedStudentId).toBe("student-1");
    });

    it("should not select student in student mode", () => {
      state = createState("student");
      state.startDrag("student-1", "Alice Smith");

      expect(state.selectedStudentId).toBeNull();
    });
  });

  describe("action: endDrag", () => {
    it("should add pending move in teacher mode", () => {
      state = createState("teacher");
      state.startDrag("student-1", "Alice Smith");
      state.endDrag("2");

      expect(state.pendingMoves.get("student-1")).toBe("2");
      expect(state.draggingStudentId).toBeNull();
    });

    it("should handle drop on no-group zone", () => {
      state = createState("teacher");
      state.startDrag("student-1", "Alice Smith");
      state.endDrag("no-group", true);

      expect(state.pendingMoves.get("student-1")).toBeNull();
    });

    it("should set selected group in student mode when dragging self", () => {
      mockUser.id = "student-4";
      state = createState("student");
      state.startDrag("student-4", "David Brown");
      state.endDrag("1");

      expect(state.selectedGroupId).toBe("1");
    });

    it("should clear drag state even when no target", () => {
      state = createState("teacher");
      state.startDrag("student-1", "Alice Smith");
      state.endDrag(null);

      expect(state.draggingStudentId).toBeNull();
      expect(state.draggingStudentName).toBeNull();
    });
  });

  describe("action: setShowLastNameFirst", () => {
    it("should update showLastNameFirst", () => {
      state = createState();
      state.setShowLastNameFirst(true);

      expect(state.showLastNameFirst).toBe(true);

      state.setShowLastNameFirst(false);
      expect(state.showLastNameFirst).toBe(false);
    });
  });

  describe("action: save", () => {
    it("should call onSave with pending moves in teacher mode", async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      state = createState("teacher");
      state.selectedStudentId = "student-1";
      state.selectGroup("2");

      await state.save(onSave);

      expect(onSave).toHaveBeenCalledWith(state.pendingMoves);
      expect(state.isSaving).toBe(false);
    });

    it("should call moveStudentToGroup in student mode", async () => {
      mockUser.id = "student-4";
      state = createState("student");
      state.selectedGroupId = "1";

      await state.save();

      expect(mockDb.moveStudentToGroup).toHaveBeenCalledWith("student-4", "1");
    });

    it("should create empty groups first", async () => {
      state = createState("teacher");
      state.createdGroupsInSession = new Set(["5"]);
      // No pending moves to group 5, so it's empty

      await state.save(jest.fn().mockResolvedValue(undefined));

      expect(mockDb.createEmptyGroup).toHaveBeenCalledWith("5");
    });

    it("should set isSaving during operation", async () => {
      state = createState("teacher");
      state.selectedStudentId = "student-1";
      state.selectGroup("2");

      let savingDuringOperation = false;
      const onSave = jest.fn().mockImplementation(() => {
        savingDuringOperation = state.isSaving;
        return Promise.resolve();
      });

      await state.save(onSave);

      expect(savingDuringOperation).toBe(true);
      expect(state.isSaving).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Save failed");
      const onSave = jest.fn().mockRejectedValue(error);
      state = createState("teacher");
      state.selectedStudentId = "student-1";
      state.selectGroup("2");

      await expect(state.save(onSave)).rejects.toThrow("Save failed");
      expect(state.isSaving).toBe(false);
    });
  });

  describe("action: saveFirstTimeJoin", () => {
    it("should call moveStudentToGroup for current user", async () => {
      mockUser.id = "student-4";
      state = createState("student");
      state.selectedGroupId = "1";

      await state.saveFirstTimeJoin();

      expect(mockDb.moveStudentToGroup).toHaveBeenCalledWith("student-4", "1");
    });

    it("should do nothing if no group selected", async () => {
      mockUser.id = "student-4";
      state = createState("student");

      await state.saveFirstTimeJoin();

      expect(mockDb.moveStudentToGroup).not.toHaveBeenCalled();
    });
  });

  describe("helper: getStudentsForGroup", () => {
    it("should return students in specified group", () => {
      state = createState();
      const students = state.getStudentsForGroup("1");

      expect(students.length).toBe(2);
      expect(students.map(s => s.id)).toContain("student-1");
      expect(students.map(s => s.id)).toContain("student-2");
    });

    it("should return unassigned students when groupId is null", () => {
      state = createState();
      const students = state.getStudentsForGroup(null);

      expect(students.length).toBe(1);
      expect(students[0].id).toBe("student-4");
    });

    it("should format names with last name first when enabled", () => {
      state = createState();
      state.setShowLastNameFirst(true);
      const students = state.getStudentsForGroup("1");

      const alice = students.find(s => s.id === "student-1");
      expect(alice?.name).toBe("Smith, Alice");
    });

    it("should include connection status", () => {
      state = createState();
      const students = state.getStudentsForGroup("1");

      expect(students[0].isConnected).toBe(true);
    });
  });

  describe("helper: canDragStudent", () => {
    it("should return true for any student in teacher mode", () => {
      state = createState("teacher");

      expect(state.canDragStudent("student-1")).toBe(true);
      expect(state.canDragStudent("student-4")).toBe(true);
    });

    it("should return true only for self in student mode", () => {
      mockUser.id = "student-1";
      state = createState("student");

      expect(state.canDragStudent("student-1")).toBe(true);
      expect(state.canDragStudent("student-2")).toBe(false);
    });
  });

  describe("helper: isDropTarget", () => {
    it("should return true when student being moved is not in target group", () => {
      state = createState("teacher");
      state.selectedStudentId = "student-1"; // In group 1

      expect(state.isDropTarget("2")).toBe(true);
      expect(state.isDropTarget("1")).toBe(false);
    });

    it("should return false when no student is selected", () => {
      state = createState("teacher");

      expect(state.isDropTarget("2")).toBe(false);
    });

    it("should use dragging student if present", () => {
      state = createState("teacher");
      state.draggingStudentId = "student-1";

      expect(state.isDropTarget("2")).toBe(true);
    });
  });

  describe("helper: isNoGroupDropTarget", () => {
    it("should return true when student has a group in teacher mode", () => {
      state = createState("teacher");
      state.selectedStudentId = "student-1"; // In group 1

      expect(state.isNoGroupDropTarget()).toBe(true);
    });

    it("should return false when student has no group", () => {
      state = createState("teacher");
      state.selectedStudentId = "student-4"; // Not in any group

      expect(state.isNoGroupDropTarget()).toBe(false);
    });

    it("should return false in student mode", () => {
      mockUser.id = "student-1";
      state = createState("student");

      expect(state.isNoGroupDropTarget()).toBe(false);
    });
  });
});
