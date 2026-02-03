import React from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import { useDroppable } from "@dnd-kit/core";
import { StudentCard, StudentCardInfo } from "./student-card";

import AddIconSvg from "../../assets/icons/add/add-icon.svg";

import "./group-card.scss";

interface IProps {
  canDragStudent?: (studentId: string) => boolean;
  groupId: string;
  groupLabel: string;
  isCurrentUserGroup?: boolean;
  isDropTarget?: boolean;
  isNewGroup?: boolean;
  isNoGroup?: boolean;
  selectedStudentId?: string | null;
  students: StudentCardInfo[];
  onStudentSelect?: (studentId: string) => void;
  onGroupSelect?: (groupId: string) => void;
}

export const GroupCard: React.FC<IProps> = observer(function GroupCard({
  canDragStudent,
  groupId,
  groupLabel,
  isCurrentUserGroup = false,
  isDropTarget = false,
  isNewGroup = false,
  isNoGroup = false,
  selectedStudentId,
  students,
  onStudentSelect,
  onGroupSelect,
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `group-${groupId}`,
    data: { groupId, isNoGroup }
  });

  const handleGroupSelect = () => {
    onGroupSelect?.(groupId);
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
        const canDrag = !canDragStudent || canDragStudent(student.id);
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
            onStudentSelect={canDrag ? onStudentSelect : undefined}
          />
        );
      })}
    </div>
  );

  const cardClasses = classNames("group-card", {
    "clickable": !!onGroupSelect && !!selectedStudentId,
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
      // Only enable tabbing when the group is selectable. The `onGroupSelect` prop may be undefined in some cases
      // (e.g., for the "No Group" card in the student view since students shouldn't be able to move themselves there).
      role={onGroupSelect ? "button" : undefined}
      tabIndex={onGroupSelect ? 0 : undefined}
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
