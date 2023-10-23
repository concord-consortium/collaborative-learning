import React, { useState } from "react";
import classNames from "classnames";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { gImageMap } from "../../../models/image-map";
import { IAttribute } from "../../../models/data/attribute";

interface IProps {
  caseId: string;
  model: ITileModel;
  attr: IAttribute;
}

export const SortCardAttribute: React.FC<IProps> = ({ model, caseId, attr }) => {
  const content = model.content as DataCardContentModelType;
  const value = content.dataSet.getStrValue(caseId, attr.id);
  const isImage = gImageMap.isImageUrl(value);
  const [imageUrl, setImageUrl] = useState("");

  const caseHighlighted = content.dataSet.isHighlightedCaseId(caseId);

  isImage && gImageMap.getImage(value).then((image)=>{
    setImageUrl(image.displayUrl || "");
  });

  return (
    <div className="attribute-value-row">
      <div className="attribute">{attr.name}</div>
      <div className={classNames("value", { highlighted: caseHighlighted })}>
        { !isImage && value }
        { isImage && <img src={imageUrl} className="image-value" /> }
      </div>
    </div>
  );
};
