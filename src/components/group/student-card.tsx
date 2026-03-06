import React from "react";
import classNames from "classnames";
import { useDraggable } from "@dnd-kit/core";

import "./student-card.scss";

type StudentCardDragData = {
  studentId: string;
  studentName: string;
  type: "student";
};

export type StudentCardInfo = {
  id: string;
  isConnected: boolean;
  name: string;
};

export function isStudentCardDragData(data: any): data is StudentCardDragData {
  return data?.type === "student";
}

interface IProps {
  canDrag?: boolean;
  excludeFromTabOrder?: boolean;
  isConnected: boolean;
  isSelected?: boolean;
  name: string;
  studentId?: string;
  onStudentSelect?: (studentId: string) => void;
}

export const StudentCard: React.FC<IProps> = ({
  canDrag = false,
  excludeFromTabOrder = false,
  isConnected,
  isSelected = false,
  name,
  studentId,
  onStudentSelect
}) => {
  const isDraggable = canDrag && !!studentId;

  const dragData: StudentCardDragData = {
    studentId: studentId ?? "",
    studentName: name,
    type: "student"
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: studentId ? `student-${studentId}` : "student-overlay",
    data: dragData,
    disabled: !isDraggable
  });

  const handleStudentSelect = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (studentId) {
      e.stopPropagation();
      onStudentSelect?.(studentId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && studentId && onStudentSelect) {
      e.preventDefault();
      e.stopPropagation();
      handleStudentSelect(e);
    }
  };

  const studentClasses = classNames("student-card", {
    "connected": isConnected,
    "disconnected": !isConnected,
    "draggable": isDraggable,
    "dragging": isDragging,
    "selected": isSelected
  });

  const isClickable = !!onStudentSelect && !!studentId;
  const isFocusable = (isClickable || isDraggable) && !excludeFromTabOrder;

  return (
    <div
      ref={isDraggable ? setNodeRef : undefined}
      className={studentClasses}
      data-testid={studentId ? `student-card-${studentId}` : undefined}
      {...(isDraggable ? listeners : {})}
      {...(isDraggable ? attributes : {})}
      tabIndex={isFocusable ? 0 : -1}
      onClick={handleStudentSelect}
      onKeyDown={isClickable ? handleKeyDown : undefined}
    >
      <span className="student-card__status" />
      <span className="student-card__name">{name}</span>
    </div>
  );
};
