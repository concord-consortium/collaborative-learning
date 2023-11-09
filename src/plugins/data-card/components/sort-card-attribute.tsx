import React, { useState } from "react";
import classNames from "classnames";
import { observer } from "mobx-react-lite";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { useIsLinked } from "../use-is-linked";
import { gImageMap } from "../../../models/image-map";
import { IAttribute } from "../../../models/data/attribute";

interface IProps {
  caseId: string;
  model: ITileModel;
  attr: IAttribute;
}

export const SortCardAttribute: React.FC<IProps> = observer(({ model, caseId, attr }) => {
  const content = model.content as DataCardContentModelType;
  const dataSet = content.dataSet;
  const value = dataSet.getStrValue(caseId, attr.id);
  const isLinked = useIsLinked();
  const isImage = gImageMap.isImageUrl(value);
  const [imageUrl, setImageUrl] = useState("");

  const attributeHighlighted = dataSet.isAttributeSelected(attr.id);
  const caseHighlighted = dataSet.isCaseSelected(caseId);

  isImage && gImageMap.getImage(value).then((image)=>{
    setImageUrl(image.displayUrl || "");
  });

  function handleAttributeClick() {
    dataSet.setSelectedAttributes([attr.id]);
  }

  const attributeClassNames = classNames(
    "attribute",
    {
      highlighted: attributeHighlighted,
      linked: isLinked
    }
  );
  const valueClassNames = classNames(
    "value",
    {
      highlighted: caseHighlighted || attributeHighlighted,
      linked: isLinked
    }
  );
  return (
    <div className="attribute-value-row">
      <div className={attributeClassNames} onClick={handleAttributeClick}>
        {attr.name}
      </div>
      <div className={valueClassNames}>
        { !isImage && value }
        { isImage && <img src={imageUrl} className="image-value" /> }
      </div>
    </div>
  );
});
