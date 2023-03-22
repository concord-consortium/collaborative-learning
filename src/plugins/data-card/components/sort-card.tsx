import React, { useState, useEffect } from "react";
import classNames from "classnames";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { SortCardAttribute } from "./sort-card-attribute";

interface IProps {
  caseId: string;
  model: ITileModel;
  indexInStack: number;
  totalInStack: number;
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
  const { r, g, b } = getShadeRGB(indexInStack);
  const shadeStr = `rgb(${r},${g},${b})`;
  const atStackTop = stackCardNumberDisplay === totalInStack;

  const [expanded, setExpanded] = useState(false);
  useEffect(()=> setExpanded(atStackTop), [atStackTop]); // "top" card loads expanded
  const toggleExpanded = () => setExpanded(!expanded);
  const cardClasses = classNames("sortable", "card", { collapsed: !expanded }, { expanded });

  const loadAsSingle = () => {
    content.setSelectedSortAttributeId("");
    content.setCaseIndex(content.dataSet.caseIndexFromID(caseId));
  };

  return (
    <div className={cardClasses} id={caseId} onDoubleClick={loadAsSingle}>
      <div className="heading" style={{ backgroundColor: shadeStr }}>
        <div className="expand-toggle-area">
          <button className="expand-toggle" onClick={toggleExpanded}>▶</button>
        </div>
        <div className="card-count-info">
          { `Card ${ deckCardNumberDisplay } of ${ content.totalCases } `}
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

      <div className="footer" style={{ backgroundColor: shadeStr }}></div>

    </div>
  );
};
