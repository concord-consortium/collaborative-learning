import React, { useEffect, useRef, useState } from "react";
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

const setStackHeight = (stackRef: React.RefObject<HTMLDivElement>, isExpanded: boolean) => {
  if (!stackRef.current) return;
  if (isExpanded){
    stackRef.current.style.height = "auto";
  } else {
    setTimeout(() => { // issue 1: hack to get the height to update after the cards have been rendered
      if (!stackRef.current) return;
      let maxHeight = 0;
      Array.from(stackRef.current.children).forEach(child => {
        const rect = child.getBoundingClientRect();
        console.log("| too small?", child.id, Math.round(rect.height)); // issue 2: too small expand/unexpand or drag
        if (rect.height > maxHeight) {
          maxHeight = rect.height;
        }
      });
      stackRef.current.style.height = `${maxHeight}px`;
    }, 0);
  }
};

export const SortStack: React.FC<IProps> = ({ model, stackValue, inAttributeId, draggingActive }) => {
  const content = model.content as DataCardContentModelType;
  const stackValueDisplayString = getStackValueDisplayString(stackValue);
  const stackClasses = classNames("stack-cards", inAttributeId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [caseIds, setCaseIds] = useState<string[]>([]);
  const stackRef = useRef<HTMLDivElement>(null);

  // useEffect(() => {
  //   setStackHeight(stackRef, isExpanded);
  // }, [isExpanded]);

  useEffect(() => {
    setCaseIds(content.caseIdsFromAttributeValue(inAttributeId, stackValue));
    setStackHeight(stackRef, isExpanded);
  }, [inAttributeId, stackValue, content, draggingActive, isExpanded]);

  const advanceStack = () => {
    const fromFirst = caseIds.shift() as string;
    caseIds.push(fromFirst);
    setCaseIds([...caseIds]);
  };

  const rewindStack = () => {
    const fromLast = caseIds.pop() as string;
    caseIds.unshift(fromLast);
    setCaseIds([...caseIds]);
  };

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

  const expandToggleClasses = classNames("stack-expand-toggle",
  {"expanded": isExpanded, "collapsed": !isExpanded}
);

  return (
    <div className={cellStackClasses}>
      <div className="stack-heading">
        {stackValueDisplayString}
      </div>
      <div className="stack-controls">
        <button className={expandToggleClasses} onClick={toggleExpanded}/>
        <div className="stack-nav-buttons">
          <button className="previous" onClick={rewindStack} />
          <CasesCountDisplay totalCases={caseIds.length} />
          <button className="next" onClick={advanceStack} />
        </div>
      </div>
      <div className={dropZoneClasses} ref={setNodeRef}></div>
      <div className={stackClasses} ref={stackRef}>
        {
          caseIds.map((cid, i) => {
            return <SortCard
              key={cid}
              model={model}
              caseId={cid}
              indexInStack={i}
              totalInStack={caseIds.length}
              stackIsExpanded={isExpanded}
            />;
          })
        }
      </div>
    </div>
  );
};
