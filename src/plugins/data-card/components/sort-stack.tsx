import React from "react";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { SortCard } from "./sort-card";
import classNames from "classnames";
import { gImageMap } from "../../../models/image-map";
import { useDroppable } from "@dnd-kit/core";
import { CasesCountDisplay } from "./cases-count-display";

interface IProps {
  stackValue: string;
  inAttributeId: string;
  model: ITileModel;
  id?: string;
  passedRef?:any;
  draggingActive?: boolean;
}

const getStackValueDisplayString = (value: string) => {
  if (value === "") return "(no value)";
  if (gImageMap.isImageUrl(value)) return "(image)";
  if (value.length < 14) return value;
  return value.slice(0, 13) + '... ';
};

export const SortStack: React.FC<IProps> = ({ model, stackValue, inAttributeId, draggingActive }) => {
  const content = model.content as DataCardContentModelType;
  const caseIds = content.caseIdsFromAttributeValue(inAttributeId, stackValue);
  const stackValueDisplayString = getStackValueDisplayString(stackValue);
  const stackClasses = classNames("stack-cards", inAttributeId);
  const [isExpanded, setIsExpanded] = React.useState(false);

  const { isOver, setNodeRef } = useDroppable({
    id: `droppable-sort-stack-${inAttributeId}-${stackValue}}`,
    data: { stackValue, inAttributeId }
  });

  const dropZoneClasses = classNames(
   "stack-drop-zone",
   {"show-droppable": draggingActive },
   { "is-over" : isOver}
  );

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const cellStackClasses = classNames("cell stack",
    {"expanded": isExpanded, "collapsed": !isExpanded}
  );

  return (
    <div className={cellStackClasses}>
      <div className="stack-heading">
        {stackValueDisplayString}
      </div>
      <div className="stack-controls">
        <button className="stack-expand-toggle" onClick={toggleExpanded}>tog</button>
        <div className="stack-nav-buttons">
          <button className="prev">&lt;</button>
          <CasesCountDisplay totalCases={caseIds.length} />
          <button className="next">&gt;</button>
        </div>
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
