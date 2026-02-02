import React, { useCallback, useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import Modal from "react-modal";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors
} from "@dnd-kit/core";
import { useStores } from "../../hooks/use-stores";
import { UserType } from "../../models/stores/user-types";
import { GroupCard } from "./group-card";
import { isStudentCardDragData, StudentCard, StudentCardInfo } from "./student-card";

import CloseIconSvg from "../../assets/icons/close/close.svg";

import "./group-management-modal.scss";

interface IProps {
  allowCancel?: boolean;
  isOpen: boolean;
  mode: UserType;
  onClose: () => void;
  onSave?: (moves: Map<string, string | null>) => Promise<void>;
}

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

export const GroupManagementModal: React.FC<IProps> = observer(
  function GroupManagementModal({ allowCancel = true, isOpen, mode, onClose, onSave }) {
    const stores = useStores();
    const { groups, class: classStore, user, db } = stores;
    const isTeacherMode = mode === "teacher" || mode === "researcher";
    const [pendingMoves, setPendingMoves] = useState<Map<string, string | null>>(new Map());
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [createdGroupsInSession, setCreatedGroupsInSession] = useState<Set<string>>(new Set());
    const [showLastNameFirst, setShowLastNameFirst] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [draggingStudentId, setDraggingStudentId] = useState<string | null>(null);
    const [draggingStudentName, setDraggingStudentName] = useState<string | null>(null);
    const [draggingStudentConnected, setDraggingStudentConnected] = useState(false);

    // dnd-kit sensors - require a small movement before starting drag
    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          distance: 3
        }
      })
    );

    // Reset state when modal opens to ensure fresh data from the store
    useEffect(() => {
      if (isOpen) {
        setPendingMoves(new Map());
        setSelectedStudentId(null);
        setSelectedGroupId(null);
        setCreatedGroupsInSession(new Set());
        setDraggingStudentId(null);
        setDraggingStudentName(null);
        setDraggingStudentConnected(false);
      }
    }, [isOpen]);

    const allStudents = useMemo(() => classStore.students, [classStore.students]);
    const studentGroupMap = useMemo(() => {
      const map = new Map<string, string | null>();
      allStudents.forEach(student => {
        const group = groups.groupForUser(student.id);
        map.set(student.id, group?.id || null);
      });

      if (isTeacherMode) {
        pendingMoves.forEach((toGroupId, studentId) => {
          map.set(studentId, toGroupId);
        });
      }

      if (mode === "student" && selectedGroupId !== null) {
        map.set(user.id, selectedGroupId);
      }

      return map;
    }, [allStudents, isTeacherMode, mode, selectedGroupId, groups, pendingMoves, user.id]);

    const getStudentsForGroup = useCallback((groupId: string | null): StudentCardInfo[] => {
      return allStudents
        .filter(student => studentGroupMap.get(student.id) === groupId)
        .map(student => {
          const studentGroup = groups.groupForUser(student.id);
          const isConnected = studentGroup?.getUserById(student.id)?.connected ?? false;

          return {
            id: student.id,
            isConnected,
            name: formatStudentName(student.fullName, showLastNameFirst)
          };
        });
    }, [allStudents, studentGroupMap, groups, showLastNameFirst]);

    // Students not in any group
    const unassignedStudents = useMemo(() => getStudentsForGroup(null), [getStudentsForGroup]);

    const existingGroupIds = useMemo(() => {
      return new Set(groups.allGroups.map(g => g.id));
    }, [groups.allGroups]);

    // Get new group IDs created via pending moves (teacher mode) or selected group (student mode).
    // These are IDs that don't exist in allGroups yet.
    const newGroupIds = useMemo(() => {
      const ids: string[] = [];

      if (isTeacherMode) {
        pendingMoves.forEach((toGroupId) => {
          if (toGroupId !== null && !existingGroupIds.has(toGroupId)) {
            if (!ids.includes(toGroupId)) {
              ids.push(toGroupId);
            }
          }
        });
      }

      if (mode === "student" && selectedGroupId !== null && !existingGroupIds.has(selectedGroupId)) {
        if (!ids.includes(selectedGroupId)) {
          ids.push(selectedGroupId);
        }
      }

      // Include all groups created in this session, including empty groups.
      createdGroupsInSession.forEach(groupId => {
        if (!existingGroupIds.has(groupId) && !ids.includes(groupId)) {
          ids.push(groupId);
        }
      });

      return ids.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    }, [isTeacherMode, mode, selectedGroupId, existingGroupIds, createdGroupsInSession, pendingMoves]);

    // Determine the next available group ID for "New Group".
    const nextGroupId = useMemo(() => {
      const allUsedIds = new Set([...existingGroupIds, ...newGroupIds]);
      const existingNumericIds = [...allUsedIds]
        .map(id => parseInt(id, 10))
        .filter(n => !isNaN(n));
      const maxId = existingNumericIds.length > 0 ? Math.max(...existingNumericIds) : 0;
      return String(maxId + 1);
    }, [existingGroupIds, newGroupIds]);

    // Current user's group (for student mode).
    const currentUserGroupId = groups.groupForUser(user.id)?.id || null;

    // First-time join: student mode where the current user has no group yet
    const isFirstTimeJoin = mode === "student" && currentUserGroupId === null;

    // In student mode, the current user is always "selected" for moving
    const effectiveSelectedStudentId = mode === "student" ? user.id : selectedStudentId;

    const handleStudentSelect = useCallback((studentId: string) => {
      if (isTeacherMode) {
        setSelectedStudentId(prev => prev === studentId ? null : studentId);
      }
    }, [isTeacherMode]);

    const handleGroupSelect = useCallback(async (groupId: string) => {
      if (isTeacherMode && selectedStudentId) {
        const currentGroupId = studentGroupMap.get(selectedStudentId);
        if (currentGroupId !== groupId) {
          if (!existingGroupIds.has(groupId)) {
            setCreatedGroupsInSession(prev => new Set([...prev, groupId]));
          }

          setPendingMoves(prev => {
            const newMoves = new Map(prev);
            newMoves.set(selectedStudentId, groupId);
            return newMoves;
          });
        }
        setSelectedStudentId(null);
      } else if (mode === "student") {
        if (!existingGroupIds.has(groupId)) {
          setCreatedGroupsInSession(prev => new Set([...prev, groupId]));
        }

        setSelectedGroupId(groupId);

        // For first-time join (no cancel option), auto-save immediately.
        if (!allowCancel) {
          setIsSaving(true);
          try {
            await db.moveStudentToGroup(user.id, groupId);
            // Modal will close automatically when user.currentGroupId is updated.
          } catch (error) {
            console.error("Error joining group:", error);
          } finally {
            setIsSaving(false);
          }
        }
      }
    }, [isTeacherMode, selectedStudentId, mode, studentGroupMap, allowCancel, db, user.id, existingGroupIds]);

    const handleNoGroupSelect = useCallback(() => {
      if (isTeacherMode && selectedStudentId) {
        setPendingMoves(prev => {
          const newMoves = new Map(prev);
          newMoves.set(selectedStudentId, null);
          return newMoves;
        });
        setSelectedStudentId(null);
      }
    }, [isTeacherMode, selectedStudentId]);

    const handleDragStart = useCallback((event: DragStartEvent) => {
      const { active } = event;
      if (isStudentCardDragData(active.data.current)) {
        const { studentId, studentName } = active.data.current;
        setDraggingStudentId(studentId);
        setDraggingStudentName(studentName);

        const studentGroup = groups.groupForUser(studentId);
        const groupUser = studentGroup?.getUserById(studentId);
        setDraggingStudentConnected(groupUser?.connected ?? false);

        if (isTeacherMode) {
          setSelectedStudentId(studentId);
        }
      }
    }, [groups, isTeacherMode]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || !isStudentCardDragData(active.data.current)) {
        setDraggingStudentId(null);
        setDraggingStudentName(null);
        setDraggingStudentConnected(false);
        return;
      }

      const { studentId } = active.data.current;
      const dropData = over.data.current as { groupId: string; isNoGroup?: boolean } | undefined;

      if (dropData) {
        const { groupId, isNoGroup } = dropData;
        const targetGroupId = isNoGroup ? null : groupId;

        if (isTeacherMode) {
          const currentGroupId = studentGroupMap.get(studentId);
          if (currentGroupId !== targetGroupId) {
            if (targetGroupId !== null && !existingGroupIds.has(targetGroupId)) {
              setCreatedGroupsInSession(prev => new Set([...prev, targetGroupId]));
            }

            setPendingMoves(prev => {
              const newMoves = new Map(prev);
              newMoves.set(studentId, targetGroupId);
              return newMoves;
            });
          }
          setSelectedStudentId(null);
        } else if (mode === "student" && studentId === user.id && targetGroupId !== null) {
          if (!existingGroupIds.has(targetGroupId)) {
            setCreatedGroupsInSession(prev => new Set([...prev, targetGroupId]));
          }

          setSelectedGroupId(targetGroupId);
        }
      }

      setDraggingStudentId(null);
      setDraggingStudentName(null);
      setDraggingStudentConnected(false);
    }, [isTeacherMode, mode, studentGroupMap, user.id, existingGroupIds]);

    const canDragStudent = useCallback((studentId: string) => {
      if (isTeacherMode) {
        return true; // Teachers and researchers can drag any student
      } else {
        return studentId === user.id; // Students can only drag themselves
      }
    }, [isTeacherMode, user.id]);

    const handleSave = useCallback(async () => {
      setIsSaving(true);
      try {
        // It's possible the user added new empty groups. Create those empty groups first.
        const emptyGroupsToCreate = [...createdGroupsInSession].filter(groupId =>
          !existingGroupIds.has(groupId) &&
          (!isTeacherMode || !Array.from(pendingMoves.values()).includes(groupId)) &&
          (isTeacherMode || groupId !== selectedGroupId)
        );

        if (emptyGroupsToCreate.length > 0) {
          for (const groupId of emptyGroupsToCreate) {
            await db.createEmptyGroup(groupId);
          }
        }

        if (isTeacherMode && onSave) {
          await onSave(pendingMoves);
        } else if (mode === "student" && selectedGroupId) {
          await db.moveStudentToGroup(user.id, selectedGroupId);
        }
        onClose();
      } catch (error) {
        console.error("Error saving group changes:", error);
      } finally {
        setIsSaving(false);
      }
    }, [
      isTeacherMode, onSave, mode, selectedGroupId, onClose, pendingMoves,
      db, user, createdGroupsInSession, existingGroupIds
    ]);

    const handleCancel = useCallback(() => {
      setPendingMoves(new Map());
      setSelectedStudentId(null);
      setSelectedGroupId(null);
      setCreatedGroupsInSession(new Set());
      onClose();
    }, [onClose]);

    const hasChanges = isTeacherMode
      ? pendingMoves.size > 0
      : selectedGroupId !== null && selectedGroupId !== currentUserGroupId;

    const modalTitle = isTeacherMode
      ? "Move Students to Different Groups"
      : currentUserGroupId === null
        ? "Join Group"
        : "Join a Different Group";

    const instructions = isTeacherMode
      ? "To move a student, select the student then select — or drag to — a different group:"
      : currentUserGroupId === null
        ? "To join a group, select a group:"
        : "To join a different group, select a group or drag your name to a group:";

    return (
      <Modal
        className="group-management-modal"
        isOpen={isOpen}
        onRequestClose={allowCancel ? handleCancel : undefined}
        overlayClassName="group-management-modal__overlay"
        shouldCloseOnEsc={allowCancel}
        shouldCloseOnOverlayClick={false}
        testId="group-management-modal"
      >
        <div className="group-management-modal__header">
          <div className="group-management-modal__icon">
            <div className="group-management-modal__icon-row">
              <div className="group-management-modal__icon-person" />
              <div className="group-management-modal__icon-person" />
            </div>
            <div className="group-management-modal__icon-row">
              <div className="group-management-modal__icon-person" />
              <div className="group-management-modal__icon-person" />
            </div>
          </div>
          <div className="group-management-modal__title" data-testid="group-management-modal-title">
            {modalTitle}
          </div>
          {allowCancel && (
            <button
              className="group-management-modal__close"
              data-testid="group-management-modal-close-button"
              type="button"
              onClick={handleCancel}
            >
              <CloseIconSvg />
            </button>
          )}
        </div>

        <div className="group-management-modal__content">
          <p className="group-management-modal__instructions">{instructions}</p>
          <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
            <div className="group-management-modal__groups-container">
              <div className="group-management-modal__groups-grid">
              {groups.allGroups.map(group => {
                const studentBeingMoved = draggingStudentId || effectiveSelectedStudentId;
                const isDropTarget = studentBeingMoved !== null
                  && studentGroupMap.get(studentBeingMoved) !== group.id;
                return (
                  <GroupCard
                    key={group.id}
                    canDragStudent={canDragStudent}
                    groupId={group.id}
                    groupLabel={`Group ${group.id}`}
                    isCurrentUserGroup={mode === "student" && group.id === currentUserGroupId}
                    isDropTarget={isDropTarget}
                    selectedStudentId={effectiveSelectedStudentId}
                    students={getStudentsForGroup(group.id)}
                    onGroupSelect={handleGroupSelect}
                    onStudentSelect={isTeacherMode ? handleStudentSelect : undefined}
                  />
                );
              })}

              {/* Potential new groups created by unsaved moves. */}
              {newGroupIds.map(groupId => {
                const studentBeingMoved = draggingStudentId || effectiveSelectedStudentId;
                const isDropTarget = studentBeingMoved !== null && studentGroupMap.get(studentBeingMoved) !== groupId;
                return (
                  <GroupCard
                    key={groupId}
                    canDragStudent={canDragStudent}
                    groupId={groupId}
                    groupLabel={`Group ${groupId}`}
                    isDropTarget={isDropTarget}
                    selectedStudentId={effectiveSelectedStudentId}
                    students={getStudentsForGroup(groupId)}
                    onGroupSelect={handleGroupSelect}
                    onStudentSelect={isTeacherMode ? handleStudentSelect : undefined}
                  />
                );
              })}

              {/* New Group card - or just "Group 1" for first-time join when no groups exist */}
              {(() => {
                // For first-time join when no groups exist yet:
                // - Show as "Group 1" (not styled as "New Group").
                // - Don't show an additional "New Group" option.
                const noGroupsExist = groups.allGroups.length === 0 && newGroupIds.length === 0;
                const showAsRegularGroup = isFirstTimeJoin && noGroupsExist;

                // Don't show "New Group" card if we've already created a "new group" selection
                // in first-time join mode (the newGroupIds.map above will show it).
                if (isFirstTimeJoin && newGroupIds.length > 0) {
                  return null;
                }

                return (
                  <GroupCard
                    groupId={nextGroupId}
                    groupLabel={`Group ${nextGroupId}`}
                    isDropTarget={draggingStudentId !== null || effectiveSelectedStudentId !== null}
                    isNewGroup={!showAsRegularGroup}
                    selectedStudentId={effectiveSelectedStudentId}
                    students={[]}
                    onGroupSelect={handleGroupSelect}
                  />
                );
              })()}

              {/* "No Group" card for unassigned students. Only appears for teachers and researchers. */}
              {(isTeacherMode && unassignedStudents.length > 0) && (
                <GroupCard
                  canDragStudent={canDragStudent}
                  groupId="no-group"
                  groupLabel="No Group"
                  isDropTarget={
                    isTeacherMode
                    && (draggingStudentId !== null || effectiveSelectedStudentId !== null)
                    && studentGroupMap.get(draggingStudentId || effectiveSelectedStudentId || "") !== null
                  }
                  isNoGroup={true}
                  selectedStudentId={effectiveSelectedStudentId}
                  students={unassignedStudents}
                  onGroupSelect={isTeacherMode ? handleNoGroupSelect : undefined}
                  onStudentSelect={isTeacherMode ? handleStudentSelect : undefined}
                />
              )}
              </div>
            </div>
            <DragOverlay>
              {draggingStudentId && draggingStudentName && (
                <StudentCard
                  isConnected={draggingStudentConnected}
                  isSelected
                  name={draggingStudentName}
                />
              )}
            </DragOverlay>
          </DndContext>
        </div>
        <div className="group-management-modal__filters">
          <span className="group-management-modal__filter">
            <span className="group-management-modal__filter-indicator" />
            Online
          </span>
          <label className="group-management-modal__filter">
            <input
              checked={showLastNameFirst}
              data-testid="group-management-modal-sort-checkbox"
              type="checkbox"
              onChange={(e) => setShowLastNameFirst(e.target.checked)}
            />
            Display names as &ldquo;Last name, First name&rdquo;
          </label>
        </div>
        <div className="group-management-modal__footer">
          {allowCancel && (
            <button
              className="group-management-modal__button cancel"
              data-testid="group-management-modal-cancel-button"
              type="button"
              onClick={handleCancel}
            >
              Cancel
            </button>
          )}
          <button
            className="group-management-modal__button save"
            data-testid="group-management-modal-save-button"
            disabled={!hasChanges || isSaving}
            type="button"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </Modal>
    );
  }
);
