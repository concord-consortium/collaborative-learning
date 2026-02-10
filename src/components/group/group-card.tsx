import React from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import { useDroppable } from "@dnd-kit/core";
import { GroupManagementState } from "../../models/group-management-state";
import { StudentCard } from "./student-card";

import AddIconSvg from "../../assets/icons/add/add-icon.svg";

import "./group-card.scss";

interface IProps {
  groupId: string;
  groupManagementState: GroupManagementState;
  isNewGroup?: boolean;
  isNoGroup?: boolean;
}

export const GroupCard: React.FC<IProps> = observer(function GroupCard({
  groupId,
  groupManagementState,
  isNewGroup = false,
  isNoGroup = false
}) {
  const groupLabel = isNoGroup ? "No Group" : `Group ${groupId}`;
  const isCurrentUserGroup = groupManagementState.mode === "student"
    && groupId === groupManagementState.currentUserGroupId;
  const selectedStudentId = groupManagementState.effectiveSelectedStudentId;
  const students = isNoGroup
    ? groupManagementState.unassignedStudents
    : groupManagementState.getStudentsForGroup(groupId);

  const isDropTarget = isNoGroup
    ? groupManagementState.isNoGroupDropTarget()
    : groupManagementState.isDropTarget(groupId);

  const canSelectGroup = isNoGroup
    ? groupManagementState.isTeacherMode  // Only teachers can move students to "No Group"
    : true;

  const canSelectStudents = groupManagementState.isTeacherMode;
  const { isOver, setNodeRef } = useDroppable({
    id: `group-${groupId}`,
    data: { groupId, isNoGroup }
  });

  const handleGroupSelect = () => {
    if (canSelectGroup) {
      groupManagementState.handleGroupCardSelect(groupId, isNoGroup);
    }
  };

  const handleStudentSelect = (studentId: string) => {
    groupManagementState.selectStudent(studentId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      e.stopPropagation();
      handleGroupSelect();
    }
  };

  const renderNewGroupIcon = () => (
    <div className="group-card__new-group-icon">
      <AddIconSvg className="group-card__plus-icon" />
      <span className="group-card__new-group-label">New Group</span>
    </div>
  );

  const renderGroupStudents = () => (
    <div className="group-card__students">
      {students.map(student => {
        const isSelected = selectedStudentId === student.id;
        const canDrag = groupManagementState.canDragStudent(student.id);
        // When a student is selected, exclude other students from tab order so user can tab directly to group cards
        // to quickly select the new group destination.
        const excludeFromTabOrder = !!selectedStudentId && !isSelected;
        return (
          <StudentCard
            key={student.id}
            canDrag={canDrag}
            excludeFromTabOrder={excludeFromTabOrder}
            isConnected={student.isConnected}
            isSelected={isSelected}
            name={student.name}
            studentId={student.id}
            onStudentSelect={canDrag && canSelectStudents ? handleStudentSelect : undefined}
          />
        );
      })}
    </div>
  );

  const containsSelectedStudent = !!selectedStudentId && students.some(s => s.id === selectedStudentId);

  const cardClasses = classNames("group-card", {
    "clickable": canSelectGroup && !!selectedStudentId && !containsSelectedStudent,
    "current": isCurrentUserGroup,
    "dragging-over": isOver,
    "drop-target": isDropTarget,
    "new-group": isNewGroup,
    "no-group": isNoGroup
  });

  return (
    <div
      ref={setNodeRef}
      className={cardClasses}
      data-testid={`group-card-${groupId}`}
      onClick={handleGroupSelect}
      onKeyDown={handleKeyDown}
      // Only enable tabbing when the group is selectable (e.g., "No Group" card is not selectable in student view
      // since students shouldn't be able to move themselves there).
      role={canSelectGroup ? "button" : undefined}
      tabIndex={canSelectGroup ? 0 : undefined}
    >
      <div className="group-card__header">
        {groupLabel}
      </div>
      <div className="group-card__content">
        {isNewGroup ? renderNewGroupIcon() : renderGroupStudents()}
      </div>
    </div>
  );
});
