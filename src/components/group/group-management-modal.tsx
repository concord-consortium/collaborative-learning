import React, { useEffect, useState } from "react";
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
    }, [isOpen, groupManagementState, allowCancel]);

    const handleDragStart = (event: DragStartEvent) => {
      const { active } = event;
      if (isStudentCardDragData(active.data.current)) {
        const { studentId, studentName } = active.data.current;
        groupManagementState.startDrag(studentId, studentName);
      }
    };

    const handleDragEnd = (event: DragEndEvent) => {
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
    };

    const handleSave = async () => {
      const success = await groupManagementState.save(onSave);
      if (success) {
        onClose();
      }
    };

    const handleCancel = () => {
      groupManagementState.reset();
      onClose();
    };

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
                  groupId={group.id}
                  groupManagementState={groupManagementState}
                />
              ))}

              {/* Potential new groups created by unsaved moves. */}
              {groupManagementState.newGroupIds.map(groupId => (
                <GroupCard
                  key={groupId}
                  groupId={groupId}
                  groupManagementState={groupManagementState}
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
                    groupManagementState={groupManagementState}
                    isNewGroup={!showAsRegularGroup}
                  />
                );
              })()}

              {/* "No Group" card for unassigned students. Only appears for teachers and researchers. */}
              {(groupManagementState.isTeacherMode && groupManagementState.unassignedStudents.length > 0) && (
                <GroupCard
                  groupId="no-group"
                  groupManagementState={groupManagementState}
                  isNoGroup={true}
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
        <div className="group-management-modal__options">
          <span className="group-management-modal__legend">
            <span className="group-management-modal__legend-indicator" />
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
          {groupManagementState.savingFailed && (
            <p className="group-management-modal__error" role="alert">
              {groupManagementState.isFirstTimeJoin
                ? "There was a problem joining the group. Please try again."
                : "There was a problem saving your changes. Please try again."}
            </p>
          )}
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
            {groupManagementState.isFirstTimeJoin ? "Join" : "Save"}
          </button>
        </div>
      </Modal>
    );
  }
);
