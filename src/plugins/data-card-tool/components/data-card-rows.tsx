import { observer } from "mobx-react";
import React, { useState } from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DataCardContentModelType } from "../data-card-content";
import { CaseAttribute } from "./case-attribute";

interface IProps {
  caseIndex: any;
  model: ToolTileModelType;
  totalCases: number;
  readOnly?: boolean;
}

export const DataCardRows: React.FC<IProps> = observer(({ caseIndex, model, readOnly }) => {
  const content = model.content as DataCardContentModelType;
  const dataSet = content.dataSet;
  const currentCaseId = content.dataSet.caseIDFromIndex(caseIndex);
  const [currEditAttrId, setCurrEditAttrId] = useState<string>("");

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
              readOnly={readOnly}
            />
          );
        })
      }
    </>
  );
});
