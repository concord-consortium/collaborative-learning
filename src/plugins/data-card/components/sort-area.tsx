import React from "react";
import { getSnapshot } from "@concord-consortium/mobx-state-tree";
import { uniq, orderBy } from "lodash";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { SortStack, SortStackPlaceholder } from "./sort-stack";

import "./sort-area.scss"
import { render } from "@testing-library/react";

interface IProps {
  model: ITileModel;
}

export const DataCardSortArea: React.FC<IProps> = ({ model }) => {
  const content = model.content as DataCardContentModelType;
  const sortById = content.selectedSortAttributeId;
  const sortByName = sortById ? content.dataSet.attrFromID(sortById).name : " "; //TODO handle unfinished attr

  const attrsSnap = getSnapshot(content.attributes);
  const allAttrValues = attrsSnap.filter((a) => a.id === sortById)[0].values;
  const uniqeOrderedValues = orderBy(uniq(allAttrValues));

  const renderPlaceholderCells = () => {
    const rowsNeeded = Math.ceil(uniqeOrderedValues.length / 3);
    const placeholders = (rowsNeeded * 3) - uniqeOrderedValues.length;
    return (
      <>
        { placeholders > 0 && <SortStackPlaceholder /> }
        { placeholders === 2 && <SortStackPlaceholder /> }
      </>
    );
  };

  return (
    <div className="sort-area-grid">
      { uniqeOrderedValues.length > 0 && sortById &&
        uniqeOrderedValues.map((v, i) => {
          return (
            <SortStack
              key={i}
              model={model}
              stackValue={v as any}
              inAttributeId={ sortById }
            />
          );
        })
      }
      { renderPlaceholderCells() }
    </div>
  );
};
