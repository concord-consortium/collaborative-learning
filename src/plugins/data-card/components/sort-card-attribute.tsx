import React, { useState } from "react";
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
  const attrName = content.dataSet.attrFromID(attr.id).name;
  const value = content.dataSet.getValue(caseId, attr.id) as string;
  const isImage = gImageMap.isImageUrl(value);
  const [imageUrl, setImageUrl] = useState("");

  isImage && gImageMap.getImage(value).then((image)=>{
    setImageUrl(image.displayUrl || "");
  });

  return (
    <div className="attribute-value-row">
      <div className="attribute">{attrName}</div>
      <div className="value">
        { !isImage && value }
        { isImage && <img src={imageUrl} className="image-value" /> }
      </div>
    </div>
  );
};
