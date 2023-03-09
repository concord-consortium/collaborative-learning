import React from "react";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { orderBy } from "lodash";

interface IProps {
  model: ITileModel;
  onSortAttrChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

export const SortSelect: React.FC<IProps> = ({ model, onSortAttrChange }) => {
  const content = model.content as DataCardContentModelType;
  const attrs = content.existingAttributesWithNames();
  const alphaAttrs = orderBy(attrs, [attr => attr.attrName.toLowerCase()]);

  return (
    <div className="sort-select">
      <label>
        Sort
        <select
          name="selectedSortAttribute"
          onChange={onSortAttrChange}
          value={content.selectedSortAttributeId}
        >
          <option value="">None</option>
          { alphaAttrs.map((a) => {
            return <option key={a.attrId} value={a.attrId}>{a.attrName}</option>;
          })}
        </select>
      </label>
    </div>
  );
};
