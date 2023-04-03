import { observer } from "mobx-react";
import React from "react";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { CaseAttribute } from "./case-attribute";
import { EditFacet } from "../data-card-types";

interface IProps {
  caseIndex: number;
  model: ITileModel;
  totalCases: number;
  readOnly?: boolean;
  imageUrlToAdd?: string;
  currEditAttrId: string;
  currEditFacet: EditFacet;
  setImageUrlToAdd: (url: string) => void;
  setCurrEditFacet: (facetName: EditFacet ) => void;
  setCurrEditAttrId: (attrId: string) => void;
}

export const DataCardRows: React.FC<IProps> = observer(({
  caseIndex, model, readOnly,
  imageUrlToAdd, currEditAttrId, currEditFacet,
  setCurrEditFacet, setCurrEditAttrId, setImageUrlToAdd
}) => {
  const content = model.content as DataCardContentModelType;
  const dataSet = content.dataSet;
  const currentCaseId = content.dataSet.caseIDFromIndex(caseIndex);

  return (
    <>
      { dataSet.attributes.map((attr) => {
        return (
          <CaseAttribute
            key={attr.id}
            model={model}
            caseId={currentCaseId}
            attrKey={attr.id}
            currEditAttrId={currEditAttrId}
            currEditFacet={currEditFacet}
            setCurrEditAttrId={setCurrEditAttrId}
            setCurrEditFacet={setCurrEditFacet}
            setImageUrlToAdd={setImageUrlToAdd}
            readOnly={readOnly}
            imageUrlToAdd={imageUrlToAdd}
          />
        );})
      }
    </>
  );
});
