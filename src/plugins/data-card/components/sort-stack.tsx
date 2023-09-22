import React from "react";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { SortCard } from "./sort-card";
import classNames from "classnames";
import { gImageMap } from "../../../models/image-map";
import { useDroppable } from "@dnd-kit/core";

interface IProps {
  stackValue: string;
  inAttributeId: string;
  model: ITileModel;
  id?: string;
  passedRef?:any;
  draggingActive?: boolean;
}

const getStackValueDisplay = (value: string) => {
  if (value === "") return "(no value)";
  if (gImageMap.isImageUrl(value)) return "(image)";
  if (value.length < 14) return value;
  return value.slice(0, 13) + '... ';
};

export const SortStack: React.FC<IProps> = ({ model, stackValue, inAttributeId, draggingActive }) => {
  const content = model.content as DataCardContentModelType;
  const caseIds = content.caseIdsFromAttributeValue(inAttributeId, stackValue);
  const units = caseIds.length > 1 ? "cards" : "card";
  const stackValueDisplay = getStackValueDisplay(stackValue);
  const stackClasses = classNames("stack-cards", inAttributeId);

  const { isOver, setNodeRef } = useDroppable({
    id: `droppable-sort-stack-${inAttributeId}-${stackValue}}`,
    data: { stackValue, inAttributeId }
  });

  const dropZoneClasses = classNames(
   "stack-drop-zone",
   { "show-droppable": draggingActive },
   { "is-over" : isOver }
  );

  return (
    <div className="cell stack">
      <div className="stack-heading">
        {stackValueDisplay}: {caseIds.length} {units}
      </div>
      <div className={dropZoneClasses} ref={setNodeRef}></div>
      <div className={stackClasses}>
        {
          caseIds.map((cid, i) => {
            return <SortCard
              key={cid}
              model={model}
              caseId={cid}
              indexInStack={i}
              totalInStack={caseIds.length}
            />;
          })
        }
      </div>
    </div>
  );
};

export const SortStackPlaceholder: React.FC = () => {
  return <div className="empty cell"></div>;
};
