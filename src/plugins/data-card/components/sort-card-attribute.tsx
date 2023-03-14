import React, { useState } from "react";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { gImageMap } from "../../../models/image-map";

interface IProps {
  caseId: string;
  model: ITileModel;
  attr: any
}

// TODO improve this to break on nearest word ending
const getTruncated = (val:string) => {
  if (!val) return;
  if (val.length > 50) return val.slice(0, 48) + "...";
  return val;
};

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
    <div className="attribute-value-row" style={{ display: "flex"}}>
      <div className="attribute" style={{ width: "60px"}}>{attrName}</div>
      <div className="value">
        { !isImage && getTruncated(value as string) }
        { isImage && <img src={imageUrl} className="image-value" /> }
      </div>
    </div>
  );
};
