import React, { useState } from "react";
import { uniq, orderBy } from "lodash";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { SortStack, SortStackPlaceholder } from "./sort-stack";
import { useDndMonitor } from "@dnd-kit/core";

import "./sort-area.scss";

interface IProps {
  isLinked?: boolean;
  model: ITileModel;
}

export const DataCardSortArea: React.FC<IProps> = ({ isLinked, model }) => {
  const content = model.content as DataCardContentModelType;
  const sortById = content.selectedSortAttributeId;

  const attribute = sortById ? content.dataSet.attrFromID(sortById) : undefined;
  const allAttrValues = attribute?.strValues || [];
  const uniqueOrderedValues = orderBy(uniq(allAttrValues));
  // orderBy will put "" first, we want it last
  if (uniqueOrderedValues[0] === "") {
    uniqueOrderedValues.shift();
    uniqueOrderedValues.push("");
  }

  const [sortDragActive, setSortDragActive] = useState(false);

  const renderPlaceholderCells = () => {
    const columnsCount = 3; // local constant now, but may be dynamic in future
    const rowsNeeded = Math.ceil(uniqueOrderedValues.length / columnsCount);
    const placeholdersNeeded = (rowsNeeded * columnsCount) - uniqueOrderedValues.length;
    const placeholders = Array.from({ length: placeholdersNeeded }, (v, i) => {
      return <SortStackPlaceholder key={i} />;
    });
    return placeholders;
  };

  useDndMonitor({
    onDragStart: (e) => {
      e.active.data.current?.sortDrag && setSortDragActive(true);
    },
    onDragEnd: (e) => {
      if (e.active.data.current?.sortDrag) {
        const draggingId = e.active?.data?.current?.caseId;
        const attrId = e.active?.data?.current?.sortedByAttrId;
        const draggedToValue = e.over?.data?.current?.stackValue;
        draggedToValue && content.setAttValue(draggingId, attrId, draggedToValue);
        setSortDragActive(false);
      }
    }
  });

  return (
    <div className="sort-area-grid">
      {uniqueOrderedValues.length > 0 && sortById &&
        uniqueOrderedValues.map((value, i) => {
          return (
            <SortStack
              key={`${sortById}-${value}`}
              id={`${sortById}-${value}`}
              isLinked={isLinked}
              model={model}
              stackValue={value}
              inAttributeId={sortById}
              draggingActive={sortDragActive}
            />
          );
        })
      }
      {renderPlaceholderCells()}
    </div>
  );
};
