import React, { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react";
import Modal from "react-modal";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors
} from "@dnd-kit/core";
import { useStores } from "../../hooks/use-stores";
import { UserType } from "../../models/stores/user-types";
import { GroupManagementState } from "../../models/group-management-state";
import { GroupCard } from "./group-card";
import { isStudentCardDragData, StudentCard } from "./student-card";

import CloseIconSvg from "../../assets/icons/close/close.svg";

import "./group-management-modal.scss";

interface IProps {
  allowCancel?: boolean;
  isOpen: boolean;
  mode: UserType;
  onClose: () => void;
  onSave?: (moves: Map<string, string | null>) => Promise<void>;
}

export const GroupManagementModal: React.FC<IProps> = observer(
  function GroupManagementModal({ allowCancel = true, isOpen, mode, onClose, onSave }) {
    const stores = useStores();
    const { groups, class: classStore, user, db } = stores;
    const [groupManagementState] = useState(() =>
      new GroupManagementState(groups, classStore, user, db, mode)
    );

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
        groupManagementState.reset();
      }
    }, [isOpen, groupManagementState]);

    const handleStudentSelect = useCallback((studentId: string) => {
      groupManagementState.selectStudent(studentId);
    }, [groupManagementState]);

    const handleGroupSelect = useCallback(async (groupId: string) => {
      groupManagementState.selectGroup(groupId);

      // For first-time join (no cancel option), auto-save immediately.
      // Modal will close automatically when user.currentGroupId is updated.
      if (!allowCancel && groupManagementState.mode === "student") {
        await groupManagementState.saveFirstTimeJoin();
      }
    }, [groupManagementState, allowCancel]);

    const handleNoGroupSelect = useCallback(() => {
      groupManagementState.moveStudentToNoGroup();
    }, [groupManagementState]);

    const handleDragStart = useCallback((event: DragStartEvent) => {
      const { active } = event;
      if (isStudentCardDragData(active.data.current)) {
        const { studentId, studentName } = active.data.current;
        groupManagementState.startDrag(studentId, studentName);
      }
    }, [groupManagementState]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || !isStudentCardDragData(active.data.current)) {
        groupManagementState.clearDragState();
        return;
      }

      const dropData = over.data.current as { groupId: string; isNoGroup?: boolean } | undefined;

      if (dropData) {
        const { groupId, isNoGroup } = dropData;
        groupManagementState.endDrag(groupId, isNoGroup);
      } else {
        groupManagementState.clearDragState();
      }
    }, [groupManagementState]);

    const handleSave = useCallback(async () => {
      try {
        await groupManagementState.save(onSave);
        onClose();
      } catch (error) {
        // Error already logged in model. TODO: Add error display in UI.
      }
    }, [groupManagementState, onSave, onClose]);

    const handleCancel = useCallback(() => {
      groupManagementState.reset();
      onClose();
    }, [groupManagementState, onClose]);

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
            {groupManagementState.modalTitle}
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
          <p className="group-management-modal__instructions">{groupManagementState.instructions}</p>
          <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
            <div className="group-management-modal__groups-container">
              <div className="group-management-modal__groups-grid">
              {groups.allGroups.map(group => (
                <GroupCard
                  key={group.id}
                  canDragStudent={groupManagementState.canDragStudent.bind(groupManagementState)}
                  groupId={group.id}
                  groupLabel={`Group ${group.id}`}
                  isCurrentUserGroup={
                    groupManagementState.mode === "student" && group.id === groupManagementState.currentUserGroupId
                  }
                  isDropTarget={groupManagementState.isDropTarget(group.id)}
                  selectedStudentId={groupManagementState.effectiveSelectedStudentId}
                  students={groupManagementState.getStudentsForGroup(group.id)}
                  onGroupSelect={handleGroupSelect}
                  onStudentSelect={groupManagementState.isTeacherMode ? handleStudentSelect : undefined}
                />
              ))}

              {/* Potential new groups created by unsaved moves. */}
              {groupManagementState.newGroupIds.map(groupId => (
                <GroupCard
                  key={groupId}
                  canDragStudent={groupManagementState.canDragStudent.bind(groupManagementState)}
                  groupId={groupId}
                  groupLabel={`Group ${groupId}`}
                  isDropTarget={groupManagementState.isDropTarget(groupId)}
                  selectedStudentId={groupManagementState.effectiveSelectedStudentId}
                  students={groupManagementState.getStudentsForGroup(groupId)}
                  onGroupSelect={handleGroupSelect}
                  onStudentSelect={groupManagementState.isTeacherMode ? handleStudentSelect : undefined}
                />
              ))}

              {/* New Group card */}
              {(() => {
                // For first-time join when no groups exist yet:
                // - Show as "Group 1" (not styled as "New Group").
                // - Don't show an additional "New Group" option.
                const noGroupsExist = groups.allGroups.length === 0 && groupManagementState.newGroupIds.length === 0;
                const showAsRegularGroup = groupManagementState.isFirstTimeJoin && noGroupsExist;

                // Don't show "New Group" card if we've already created a "new group" selection
                // in first-time join mode (the newGroupIds.map above will show it).
                if (groupManagementState.isFirstTimeJoin && groupManagementState.newGroupIds.length > 0) {
                  return null;
                }

                return (
                  <GroupCard
                    groupId={groupManagementState.nextGroupId}
                    groupLabel={`Group ${groupManagementState.nextGroupId}`}
                    isDropTarget={
                      groupManagementState.draggingStudentId !== null
                      || groupManagementState.effectiveSelectedStudentId !== null
                    }
                    isNewGroup={!showAsRegularGroup}
                    selectedStudentId={groupManagementState.effectiveSelectedStudentId}
                    students={[]}
                    onGroupSelect={handleGroupSelect}
                  />
                );
              })()}

              {/* "No Group" card for unassigned students. Only appears for teachers and researchers. */}
              {(groupManagementState.isTeacherMode && groupManagementState.unassignedStudents.length > 0) && (
                <GroupCard
                  canDragStudent={groupManagementState.canDragStudent.bind(groupManagementState)}
                  groupId="no-group"
                  groupLabel="No Group"
                  isDropTarget={groupManagementState.isNoGroupDropTarget()}
                  isNoGroup={true}
                  selectedStudentId={groupManagementState.effectiveSelectedStudentId}
                  students={groupManagementState.unassignedStudents}
                  onGroupSelect={groupManagementState.isTeacherMode ? handleNoGroupSelect : undefined}
                  onStudentSelect={groupManagementState.isTeacherMode ? handleStudentSelect : undefined}
                />
              )}
              </div>
            </div>
            <DragOverlay>
              {groupManagementState.draggingStudentId && groupManagementState.draggingStudentName && (
                <StudentCard
                  isConnected={groupManagementState.draggingStudentConnected}
                  isSelected
                  name={groupManagementState.draggingStudentName}
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
              checked={groupManagementState.showLastNameFirst}
              data-testid="group-management-modal-sort-checkbox"
              type="checkbox"
              onChange={(e) => groupManagementState.setShowLastNameFirst(e.target.checked)}
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
            disabled={!groupManagementState.hasChanges || groupManagementState.isSaving}
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
