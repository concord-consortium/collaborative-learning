import React from "react";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";

interface IProps {
  model: ITileModel;
}

export const DataCardSortArea: React.FC<IProps> = ({ model }) => {
  const content = model.content as DataCardContentModelType;

  return (
    <div className="sort-grid">
      <pre>cards sorted by { content.sortByAttributeName }</pre>
    </div>
  );
};
