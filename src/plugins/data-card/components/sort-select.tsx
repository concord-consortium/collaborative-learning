import React from "react";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";

interface IProps {
  model: ITileModel;
  onSortAttrChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

export const SortSelect: React.FC<IProps> = ({ model, onSortAttrChange }) => {
  const content = model.content as DataCardContentModelType;
  const attrNames = content.existingAttributesWithNames();

  return (
    <div className="sort-select">
      <label>
        Sort
        <select
          name="selectedSortAttribute"
          onChange={onSortAttrChange}
          value={content.sortByAttributeName}
        >
          <option value="none">None</option>
          { attrNames.map((a) => {
            return <option key={a.attrId} value={a.attrName}>{a.attrName}</option>;
          })}
        </select>
      </label>
    </div>
  );
};
