import React, { useRef, useEffect, useState } from "react";
import classNames from "classnames";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { SortCard } from "./sort-card";
import { gImageMap } from "../../../models/image-map";
import { useDroppable } from "@dnd-kit/core";
import { CasesCountDisplay } from "./cases-count-display";
import { Tooltip } from "react-tippy";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { kSortImgHeight } from "../data-card-types";

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

const getSpaceNeeded = (card: HTMLElement) => {
  const allImgs = Array.from(card.querySelectorAll('img'));
  const notLoaded = allImgs.filter(img => img.height === 0).length;
  return card.offsetHeight + notLoaded * kSortImgHeight;
};

const getChildCards = (stackRef: React.RefObject<HTMLDivElement>) => {
  return Array.from(stackRef.current?.children as HTMLCollectionOf<HTMLElement>);
};

// const applyTemporaryAnimation = (cards: HTMLElement[], keyFramesName: string) => {
//   cards.forEach(card => {
//     card.classList.add(keyFramesName);
//     setTimeout(() => card.classList.remove(keyFramesName), 100);
//   });
// };

const getMaxHeight = (cards: HTMLElement[]) => {
  let maxHeight = 0;
  cards.forEach(card => {
    const spaceNeeded = getSpaceNeeded(card);
    if (spaceNeeded > maxHeight) maxHeight = spaceNeeded;
  });
  return maxHeight;
};

export const SortStack: React.FC<IProps> = ({ model, stackValue, inAttributeId, draggingActive }) => {
  const content = model.content as DataCardContentModelType;
  const stackValueDisplayString = getStackValueDisplayString(stackValue);
  const stackClasses = classNames("stack-cards", inAttributeId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [caseIds, setCaseIds] = useState<string[]>([]);
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stackRef.current) {
      const childCards = getChildCards(stackRef);
      const maxHeight = getMaxHeight(childCards);
      //applyTemporaryAnimation(childCards, isExpanded ? "slide-down" : "slide-up");
      stackRef.current.style.height = isExpanded ? `auto` : `${maxHeight + 4}px`;
    }
  }, [caseIds, isExpanded]);

  useEffect(() => {
    setCaseIds(content.caseIdsFromAttributeValue(inAttributeId, stackValue));
  }, [inAttributeId, stackValue, content, draggingActive]);

  const advanceStack = () => {
    const fromFirst = caseIds.shift();
    fromFirst && caseIds.push(fromFirst);
    setCaseIds([...caseIds]);
  };

  const rewindStack = () => {
    const fromLast = caseIds.pop();
    fromLast && caseIds.unshift(fromLast);
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

  const stackControlsDisabled = caseIds.length < 2;

  const stackControlClasses = classNames("stack-controls",
    {"controls-disabled": stackControlsDisabled }
  );
  const previousToolTipOptions = useTooltipOptions({
    title: "previous card",
    disabled: stackControlsDisabled
  });
  const nextToolTipOptions = useTooltipOptions({
    title: "next card",
    disabled: stackControlsDisabled
  });
  const toggleToolTipOptions = useTooltipOptions({
    title: isExpanded ? "collapse" : "expand",
    disabled: stackControlsDisabled
  });

  return (
    <div className={cellStackClasses}>
      <div className="stack-heading">
        {stackValueDisplayString}
      </div>
      <div className={stackControlClasses}>
        <Tooltip {...toggleToolTipOptions}>
          <button className={expandToggleClasses} onClick={toggleExpanded} disabled={stackControlsDisabled} />
        </Tooltip>
        <div className="stack-nav-buttons">
          <Tooltip {...previousToolTipOptions}>
            <button className="previous" onClick={rewindStack} disabled={stackControlsDisabled} />
          </Tooltip>
          <CasesCountDisplay totalCases={caseIds.length} />
          <Tooltip {...nextToolTipOptions}>
            <button className="next" onClick={advanceStack} disabled={stackControlsDisabled} />
          </Tooltip>
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
