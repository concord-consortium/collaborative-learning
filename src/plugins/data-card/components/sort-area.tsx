import React, { useState} from "react";
import { getSnapshot } from "@concord-consortium/mobx-state-tree";
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

  const [draggingActive, setDraggingActive] = useState(false);

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
    onDragStart: (event) => {
      setDraggingActive(true);
    },
    onDragEnd: (event) => {
      // set the value of the attribute to the value in the stack we landed on
      const draggingId = event.active?.data?.current?.caseId;
      const attrId = event.active?.data?.current?.sortedByAttrId;
      const draggedToValue = event.over?.data?.current?.stackValue;
      draggedToValue && content.setAttValue(draggingId, attrId, draggedToValue);
      setDraggingActive(false);
    }
  });

  return (
    <div className="sort-area-grid">
      { uniqueOrderedValues.length > 0 && sortById &&
        uniqueOrderedValues.map((value, i) => {
          return (
            <SortStack
              key={`${sortById}-${value}`}
              id={`${sortById}-${value}`}
              model={model}
              stackValue={value as string}
              inAttributeId={sortById}
              draggingActive={draggingActive}
            />
          );
        })
      }
      { renderPlaceholderCells() }
    </div>
  );
};
