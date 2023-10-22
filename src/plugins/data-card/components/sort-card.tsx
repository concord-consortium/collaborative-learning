import React, { useState, useEffect } from "react";
import classNames from "classnames";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { SortCardAttribute } from "./sort-card-attribute";
import { useDraggable } from "@dnd-kit/core";
import TileDragHandle from "../../../assets/icons/drag-tile/move.svg";

interface IProps {
  caseId: string;
  model: ITileModel;
  indexInStack: number;
  totalInStack: number;
  id?: string;
}

const getShadeRGB = (index: number) => {
  const fadeBy = 12;
  const base =  { r: 111, g: 198, b: 218 }; // $workspace-teal-light-2
  return {
    r: base.r,
    g: base.g + (index * fadeBy),
    b: base.b + (index * fadeBy)
  };
};

export const SortCard: React.FC<IProps> = ({ model, caseId, indexInStack, totalInStack }) => {
  const content = model.content as DataCardContentModelType;
  const deckCardNumberDisplay = content.dataSet.caseIndexFromID(caseId) + 1;
  const stackCardNumberDisplay = indexInStack + 1;
  const caseHighlighted = content.dataSet.isCaseHighlighted(caseId);
  const { r, g, b } = getShadeRGB(indexInStack);
  const shadeStr = `rgb(${r},${g},${b})`;
  const capStyle = !caseHighlighted ? { backgroundColor: shadeStr } : undefined;
  const atStackTop = stackCardNumberDisplay === totalInStack;

  const [expanded, setExpanded] = useState(false);
  useEffect(()=> setExpanded(atStackTop), [atStackTop]); // "top" card loads expanded

  const toggleExpanded = (e: React.MouseEvent) => {
    setExpanded(!expanded);
  };

  const cardClasses = classNames(
    "sortable", "card",
    { collapsed: !expanded, expanded }
  );
  const headingClasses = classNames(
    "heading", { highlighted: content.dataSet.isCaseHighlighted(caseId) }
  );

  const {attributes, listeners, setNodeRef, transform} = useDraggable({
    id: `draggable-sort-card-${caseId}`,
    data: { caseId, sortedByAttrId: content.selectedSortAttributeId, sortDrag: true }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y -25}px, 0)`,
    zIndex: 1000,
    opacity: 0.8
  } : undefined;

  const loadAsSingle = () => {
    content.setSelectedSortAttributeId("");
    content.setCaseIndex(content.dataSet.caseIndexFromID(caseId));
  };

  return (
    <div
      className={cardClasses} id={caseId}
      onDoubleClick={loadAsSingle}
      ref={setNodeRef}
      style={style}
    >
      <div className={headingClasses} style={capStyle}>
        <div className="expand-toggle-area">
          <button className="expand-toggle" onClick={toggleExpanded}>▶</button>
        </div>
        <div className="card-count-info">
          { `Card ${ deckCardNumberDisplay } of ${ content.totalCases } `}
        </div>
        <div className="drag-handle" {...listeners} {...attributes}>
          <TileDragHandle />
        </div>
      </div>

      { expanded &&
        <div className="content">
          { content.dataSet.attributes.map((attr)=>{
            return (
              <SortCardAttribute
                key={attr.id}
                model={model}
                caseId={caseId}
                attr={attr}
              />
            );
          })}
        </div>
      }
      <div
        className={classNames("footer", { highlighted: caseHighlighted })}
        style={capStyle}
      />
    </div>
  );
};

