import React from "react";
import { getSnapshot } from "@concord-consortium/mobx-state-tree";
import { uniq, orderBy } from "lodash";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { SortStack, SortStackPlaceholder } from "./sort-stack";

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

  const renderPlaceholderCells = () => {
    const columnsCount = 3; // local constant now, but may be dynamic in future
    const rowsNeeded = Math.ceil(uniqueOrderedValues.length / columnsCount);
    const placeholdersNeeded = (rowsNeeded * columnsCount) - uniqueOrderedValues.length;
    const placeholders = Array.from({ length: placeholdersNeeded }, (v, i) => {
      return <SortStackPlaceholder key={i} />;
    });
    return placeholders;
  };

  return (
    <div className="sort-area-grid">
      { uniqueOrderedValues.length > 0 && sortById &&
        uniqueOrderedValues.map((v, i) => {
          return (
            <SortStack
              key={i}
              model={model}
              stackValue={v as string}
              inAttributeId={sortById}
            />
          );
        })
      }
      { renderPlaceholderCells() }
    </div>
  );
};
