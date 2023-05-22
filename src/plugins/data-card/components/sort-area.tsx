import React, { useState } from "react";
import { getSnapshot } from "mobx-state-tree";
import { uniq, orderBy } from "lodash";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { SortStack, SortStackPlaceholder } from "./sort-stack";
import { useDndMonitor } from "@dnd-kit/core";

import "./sort-area.scss";

interface IProps {
  model: ITileModel;
}

export const DataCardSortArea: React.FC<IProps> = ({ model }) => {
  const content = model.content as DataCardContentModelType;
  const sortById = content.selectedSortAttributeId;

  const attrsSnap = getSnapshot(content.attributes);
  const allAttrValues = attrsSnap.filter((a) => a.id === sortById)[0].values;
  const uniqueOrderedValues = orderBy(uniq(allAttrValues));
  // if one of the categories is a category for no value, put this stack last
  uniqueOrderedValues.includes("") && uniqueOrderedValues.push(uniqueOrderedValues.shift());

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
              model={model}
              stackValue={value as string}
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
