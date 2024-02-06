import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { useIsLinked } from "../use-is-linked";
import { SortCardAttribute } from "./sort-card-attribute";
import { useDraggable } from "@dnd-kit/core";
import { useSortableCardStyles } from "../use-sortable-card-style";

interface IProps {
  caseId: string;
  model: ITileModel;
  indexInStack: number;
  totalInStack: number;
  stackIsExpanded: boolean;
  id?: string;
  parentRef: any;
}

export const SortCard: React.FC<IProps> = observer( function SortCard({
  model, caseId, indexInStack, totalInStack, stackIsExpanded
}){
  const content = model.content as DataCardContentModelType;
  const deckCardNumberDisplay = content.dataSet.caseIndexFromID(caseId) + 1;
  const stackCardNumberDisplay = indexInStack + 1;
  const caseHighlighted = content.dataSet.isCaseSelected(caseId);
  const atStackTop = stackCardNumberDisplay === totalInStack;
  const isLinked = useIsLinked();

  const headingClasses = classNames(
    "heading", { highlighted: caseHighlighted, linked: isLinked }
  );

  const {attributes, listeners, setNodeRef, transform} = useDraggable({
    id: `draggable-sort-card-${caseId}`,
    data: { caseId, sortedByAttrId: content.selectedSortAttributeId, sortDrag: true }
  });

  const loadAsSingle = () => {
    content.setSelectedSortAttributeId("");
    content.setCaseIndex(content.dataSet.caseIndexFromID(caseId));
  };

  const { dynamicClasses, dynamicStyles } = useSortableCardStyles(
    { transform, indexInStack, atStackTop, stackIsExpanded }
  );

  return (
    <div
      {...listeners}
      {...attributes}
      className={dynamicClasses} id={caseId}
      onDoubleClick={loadAsSingle}
      ref={setNodeRef}
      style={dynamicStyles}
    >
      <div
        className={headingClasses}
        onClick={() => content.dataSet.setSelectedCases([caseId])}
      >
        <div className="card-count-info">
          Card <span className="card-count">{deckCardNumberDisplay}</span>
        </div>
      </div>

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
    </div>
  );
});
