import { observer } from "mobx-react";
import React from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DataCardContentModelType } from "../data-card-content";
import { CaseAttribute } from "./case-attribute";

interface IProps {
  caseIndex: any;
  model: ToolTileModelType;
  totalCases: number;
  readOnly?: boolean;
  imageUrlToAdd?: string;
  currEditAttrId: string;
  setImageUrlToAdd: (url: string) => void;
  setCurrEditAttrId: (attrId: string) => void;
}

export const DataCardRows: React.FC<IProps> = observer(({ caseIndex, model, readOnly,
  imageUrlToAdd, currEditAttrId, setCurrEditAttrId, setImageUrlToAdd}) => {
  const content = model.content as DataCardContentModelType;
  const dataSet = content.dataSet;
  const currentCaseId = content.dataSet.caseIDFromIndex(caseIndex);

  return (
    <>
      { dataSet.attributes.map((attr) => {
          return (
            <CaseAttribute
              key={attr.id}
              model={ model }
              caseId={ currentCaseId }
              attrKey={attr.id}
              currEditAttrId={currEditAttrId}
              setCurrEditAttrId={setCurrEditAttrId}
              setImageUrlToAdd={setImageUrlToAdd}
              readOnly={readOnly}
              imageUrlToAdd={imageUrlToAdd}
            />
          );
        })
      }
    </>
  );
});
