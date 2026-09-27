import React, { useEffect, useState } from "react";
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
  const cell = { attributeId: attr.id, caseId };
  const isLinked = useIsLinked();
  const isImage = gImageMap.isImageUrl(value);
  const [imageUrl, setImageUrl] = useState("");

  const attributeHighlighted = dataSet.isAttributeSelected(attr.id);
  const caseHighlighted = dataSet.isCaseSelected(caseId);

  // Same trap as CaseAttribute: resolving from the render body schedules a state update every
  // render, and React renders once more before bailing out on an unchanged value, so the
  // component never settles. Key it on the value instead.
  useEffect(() => {
    if (!isImage) {
      setImageUrl("");
      return;
    }
    let cancelled = false;
    gImageMap.getImage(value).then(image => {
      if (!cancelled) setImageUrl(image.displayUrl || "");
    });
    return () => { cancelled = true; };
  }, [isImage, value]);

  function handleAttributeClick() {
    dataSet.setSelectedAttributes([attr.id]);
  }

  function handleValueClick() {
    dataSet.setSelectedCells([cell]);
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
      highlighted: caseHighlighted || attributeHighlighted || dataSet.isCellSelected(cell),
      linked: isLinked
    }
  );

  const truncatedForSortView = (str: string) => {
    const maxChars = 22;
    if (str.length < maxChars + 1) return str;
    return str.slice(0, maxChars) + '... ';
  };

  return (
    <div className="attribute-value-row">
      <div className={attributeClassNames} onClick={handleAttributeClick}>
        {truncatedForSortView(attr.name)}
      </div>
      <div className={valueClassNames} onClick={handleValueClick}>
        { !isImage && truncatedForSortView(value) }
        { isImage && <img src={imageUrl} className="image-value" /> }
      </div>
    </div>
  );
});
