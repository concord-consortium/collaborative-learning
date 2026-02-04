import { makeAutoObservable, runInAction } from "mobx";
import { GroupsModelType } from "./stores/groups";
import { ClassModelType } from "./stores/class";
import { UserModelType } from "./stores/user";
import { DB } from "../lib/db";
import { UserType } from "./stores/user-types";
import { StudentCardInfo } from "../components/group/student-card";
import { kAnalyzerUserParams, kExemplarUserParams } from "../../shared/shared";

const formatStudentName = (fullName: string, showLastNameFirst: boolean) => {
  if (showLastNameFirst) {
    const parts = fullName.split(" ");
    if (parts.length >= 2) {
      const lastName = parts[parts.length - 1];
      const firstName = parts.slice(0, -1).join(" ");
      return `${lastName}, ${firstName}`;
    }
  }
  return fullName;
};

export class GroupManagementState {
  private groups: GroupsModelType;
  private classStore: ClassModelType;
  private user: UserModelType;
  private db: DB;

  mode: UserType;
  pendingMoves: Map<string, string | null> = new Map();
  selectedStudentId: string | null = null;
  selectedGroupId: string | null = null;
  createdGroupsInSession: Set<string> = new Set();
  showLastNameFirst = false;
  isSaving = false;
  savingFailed = false;
  draggingStudentId: string | null = null;
  draggingStudentName: string | null = null;
  draggingStudentConnected = false;

  constructor(
    groups: GroupsModelType,
    classStore: ClassModelType,
    user: UserModelType,
    db: DB,
    mode: UserType
  ) {
    makeAutoObservable(this);
    this.groups = groups;
    this.classStore = classStore;
    this.user = user;
    this.db = db;
    this.mode = mode;
  }

  get isTeacherMode(): boolean {
    return this.mode === "teacher" || this.mode === "researcher";
  }

  get allStudents() {
    // Exclude virtual users Ivan Idea and Ada Insight. They are added to the class roster for exemplar/AI
    // features but shouldn't appear as groupable students.
    return this.classStore.students.filter(
      student => student.id !== kExemplarUserParams.id && student.id !== kAnalyzerUserParams.id
    );
  }

  get existingGroupIds(): Set<string> {
    return new Set(this.groups.allGroups.map(g => g.id));
  }

  get studentGroupMap(): Map<string, string | null> {
    const map = new Map<string, string | null>();
    this.allStudents.forEach(student => {
      const group = this.groups.groupForUser(student.id);
      map.set(student.id, group?.id || null);
    });

    if (this.isTeacherMode) {
      this.pendingMoves.forEach((toGroupId, studentId) => {
        map.set(studentId, toGroupId);
      });
    }

    if (this.mode === "student" && this.selectedGroupId !== null) {
      map.set(this.user.id, this.selectedGroupId);
    }

    return map;
  }

  get newGroupIds(): string[] {
    const ids: string[] = [];

    if (this.isTeacherMode) {
      this.pendingMoves.forEach((toGroupId) => {
        if (toGroupId !== null && !this.existingGroupIds.has(toGroupId)) {
          if (!ids.includes(toGroupId)) {
            ids.push(toGroupId);
          }
        }
      });
    }

    if (this.mode === "student" && this.selectedGroupId !== null && !this.existingGroupIds.has(this.selectedGroupId)) {
      if (!ids.includes(this.selectedGroupId)) {
        ids.push(this.selectedGroupId);
      }
    }

    // Include all groups created in this session, including empty groups.
    this.createdGroupsInSession.forEach(groupId => {
      if (!this.existingGroupIds.has(groupId) && !ids.includes(groupId)) {
        ids.push(groupId);
      }
    });

    return ids.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }

  // Determines the next available group ID for "New Group".
  get nextGroupId(): string {
    const allUsedIds = new Set([...this.existingGroupIds, ...this.newGroupIds]);
    const existingNumericIds = [...allUsedIds]
      .map(id => parseInt(id, 10))
      .filter(n => !isNaN(n));
    const maxId = existingNumericIds.length > 0 ? Math.max(...existingNumericIds) : 0;
    return String(maxId + 1);
  }

  get currentUserGroupId(): string | null {
    return this.groups.groupForUser(this.user.id)?.id || null;
  }

  // First-time join: student mode where the current user has no group yet
  get isFirstTimeJoin(): boolean {
    return this.mode === "student" && this.currentUserGroupId === null;
  }

  // In student mode, the current user is always "selected" for moving
  get effectiveSelectedStudentId(): string | null {
    return this.mode === "student" ? this.user.id : this.selectedStudentId;
  }

  get hasChanges(): boolean {
    if (this.isTeacherMode) {
      return this.pendingMoves.size > 0;
    }
    return this.selectedGroupId !== null && this.selectedGroupId !== this.currentUserGroupId;
  }

  get modalTitle(): string {
    if (this.isTeacherMode) {
      return "Move Students to Different Groups";
    }
    return this.currentUserGroupId === null
      ? "Join Group"
      : "Join a Different Group";
  }

  get instructions(): string {
    if (this.isTeacherMode) {
      return "To move a student, select the student then select — or drag to — a different group:";
    }
    return this.currentUserGroupId === null
      ? "To join a group, select a group:"
      : "To join a different group, select a group or drag your name to a group:";
  }

  // Students not in any group
  get unassignedStudents(): StudentCardInfo[] {
    return this.getStudentsForGroup(null);
  }

  reset(): void {
    this.pendingMoves = new Map();
    this.selectedStudentId = null;
    this.selectedGroupId = null;
    this.createdGroupsInSession = new Set();
    this.savingFailed = false;
    this.draggingStudentId = null;
    this.draggingStudentName = null;
    this.draggingStudentConnected = false;
  }

  selectStudent(studentId: string): void {
    if (this.isTeacherMode) {
      this.selectedStudentId = this.selectedStudentId === studentId ? null : studentId;
    }
  }

  selectGroup(groupId: string): void {
    if (this.isTeacherMode && this.selectedStudentId) {
      const currentGroupId = this.studentGroupMap.get(this.selectedStudentId);
      if (currentGroupId !== groupId) {
        if (!this.existingGroupIds.has(groupId)) {
          this.createdGroupsInSession = new Set([...this.createdGroupsInSession, groupId]);
        }

        const newMoves = new Map(this.pendingMoves);
        newMoves.set(this.selectedStudentId, groupId);
        this.pendingMoves = newMoves;
      }
      this.selectedStudentId = null;
    } else if (this.mode === "student") {
      if (!this.existingGroupIds.has(groupId)) {
        this.createdGroupsInSession = new Set([...this.createdGroupsInSession, groupId]);
      }
      this.selectedGroupId = groupId;
    }
  }

  moveStudentToNoGroup(): void {
    if (this.isTeacherMode && this.selectedStudentId) {
      const newMoves = new Map(this.pendingMoves);
      newMoves.set(this.selectedStudentId, null);
      this.pendingMoves = newMoves;
      this.selectedStudentId = null;
    }
  }

  startDrag(studentId: string, studentName: string): void {
    this.draggingStudentId = studentId;
    this.draggingStudentName = studentName;

    const studentGroup = this.groups.groupForUser(studentId);
    const groupUser = studentGroup?.getUserById(studentId);
    this.draggingStudentConnected = groupUser?.connected ?? false;

    if (this.isTeacherMode) {
      this.selectedStudentId = studentId;
    }
  }

  endDrag(targetGroupId: string | null, isNoGroup = false): void {
    const studentId = this.draggingStudentId;

    if (!studentId) {
      this.clearDragState();
      return;
    }

    const effectiveTargetGroupId = isNoGroup ? null : targetGroupId;

    if (this.isTeacherMode) {
      const currentGroupId = this.studentGroupMap.get(studentId);
      if (currentGroupId !== effectiveTargetGroupId) {
        if (effectiveTargetGroupId !== null && !this.existingGroupIds.has(effectiveTargetGroupId)) {
          this.createdGroupsInSession = new Set([...this.createdGroupsInSession, effectiveTargetGroupId]);
        }

        const newMoves = new Map(this.pendingMoves);
        newMoves.set(studentId, effectiveTargetGroupId);
        this.pendingMoves = newMoves;
      }
      this.selectedStudentId = null;
    } else if (this.mode === "student" && studentId === this.user.id && effectiveTargetGroupId !== null) {
      if (!this.existingGroupIds.has(effectiveTargetGroupId)) {
        this.createdGroupsInSession = new Set([...this.createdGroupsInSession, effectiveTargetGroupId]);
      }
      this.selectedGroupId = effectiveTargetGroupId;
    }

    this.clearDragState();
  }

  clearDragState(): void {
    this.draggingStudentId = null;
    this.draggingStudentName = null;
    this.draggingStudentConnected = false;
  }

  setShowLastNameFirst(value: boolean): void {
    this.showLastNameFirst = value;
  }

  async handleGroupCardSelect(groupId: string, isNoGroup: boolean): Promise<void> {
    if (isNoGroup) {
      this.moveStudentToNoGroup();
    } else {
      this.selectGroup(groupId);
    }
  }

  async save(onSave?: (moves: Map<string, string | null>) => Promise<void>): Promise<boolean> {
    if (this.isSaving) {
      return false;
    }

    runInAction(() => {
      this.isSaving = true;
      this.savingFailed = false;
    });

    try {
      // Create empty groups that were added in this session but don't have students in them.
      const emptyGroupsToCreate = [...this.createdGroupsInSession].filter(groupId =>
        !this.existingGroupIds.has(groupId) &&
        (!this.isTeacherMode || !Array.from(this.pendingMoves.values()).includes(groupId)) &&
        (this.isTeacherMode || groupId !== this.selectedGroupId)
      );

      if (emptyGroupsToCreate.length > 0) {
        for (const groupId of emptyGroupsToCreate) {
          await this.db.createEmptyGroup(groupId);
        }
      }

      if (this.isTeacherMode && onSave) {
        await onSave(this.pendingMoves);
      } else if (this.mode === "student" && this.selectedGroupId) {
        await this.db.moveStudentToGroup(this.user.id, this.selectedGroupId);
      }

      return true;
    } catch (error) {
      console.error("Error saving group changes:", error);
      runInAction(() => {
        this.savingFailed = true;
      });
      return false;
    } finally {
      runInAction(() => {
        this.isSaving = false;
      });
    }
  }

  getStudentsForGroup(groupId: string | null): StudentCardInfo[] {
    return this.allStudents
      .filter(student => this.studentGroupMap.get(student.id) === groupId)
      .map(student => {
        const studentGroup = this.groups.groupForUser(student.id);
        const isConnected = studentGroup?.getUserById(student.id)?.connected ?? false;

        return {
          id: student.id,
          isConnected,
          name: formatStudentName(student.fullName, this.showLastNameFirst)
        };
      });
  }

  canDragStudent(studentId: string): boolean {
    if (this.isTeacherMode) {
      return true; // Teachers and researchers can drag any student
    }
    return studentId === this.user.id; // Students can only drag themselves
  }

  isDropTarget(groupId: string): boolean {
    const studentBeingMoved = this.draggingStudentId || this.effectiveSelectedStudentId;
    return studentBeingMoved !== null && this.studentGroupMap.get(studentBeingMoved) !== groupId;
  }

  isNoGroupDropTarget(): boolean {
    const studentBeingMoved = this.draggingStudentId || this.effectiveSelectedStudentId;
    return this.isTeacherMode
      && studentBeingMoved !== null
      && this.studentGroupMap.get(studentBeingMoved) !== null;
  }
}
