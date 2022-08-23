import { observer } from "mobx-react";
import classNames from "classnames";
import React, { useEffect, useState } from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DataCardContentModelType } from "../data-card-content";
import '../data-card-tool.scss';
import { looksLikeDefaultLabel } from "../data-card-types";

type EditFacet = "name" | "value" | ""

interface IProps {
  model: ToolTileModelType;
  caseId?: string;
  attrKey: string;
  currEditAttrId: string;
  setCurrEditAttrId: (attrId: string) => void;
  readOnly?: boolean;
}

export const CaseAttribute: React.FC<IProps> = observer(props => {
  const { model, caseId, attrKey, currEditAttrId, setCurrEditAttrId, readOnly } = props;
  const content = model.content as DataCardContentModelType;
  const getLabel = () => content.dataSet.attrFromID(attrKey).name;
  const getValue = () => {
    const value = caseId && content.dataSet.getValue(caseId, attrKey) || "";
    return String(value);
  };
  const [labelCandidate, setLabelCandidate] = useState(() => getLabel());
  const [valueCandidate, setValueCandidate] = useState(() => getValue());
  const [editFacet, setEditFacet] = useState<EditFacet>("");

  useEffect(() => {
    if (currEditAttrId !== attrKey) {
      setEditFacet("");
    }
  }, [attrKey, currEditAttrId]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (editFacet === "name"){
      const inputVal = event.target.value;
      setLabelCandidate(inputVal);
    }
    if (editFacet === "value"){
      const inputVal = event.target.value;
      setValueCandidate(inputVal);
    }
  };

  const handleKeyDown = (event:  React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    switch (key) {
      case "Enter":
        handleCompleteValue();
        setEditFacet("");
        break;
      case "Escape":
        if (editFacet === "name") {
          setLabelCandidate(getLabel());
        }
        else if (editFacet === "value") {
          setValueCandidate(getValue());
        }
        setEditFacet("");
        break;
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const [facet] = event.currentTarget.classList;
    activateInput(facet as EditFacet);
  };

  const handleNameBlur = () => {
    if (labelCandidate !== getLabel()) {
      content.setAttName(attrKey, labelCandidate);
    }
    setEditFacet("");
  };

  const handleCompleteValue = () => {
    if (valueCandidate !== getValue()) {
      caseId && content.setAttValue(caseId, attrKey, valueCandidate);
    }
    setEditFacet("");
  };

  const activateInput = (facet: EditFacet) => {
    setEditFacet(facet);
    if (facet === "name"){
      setLabelCandidate(getLabel());
    }
    if (facet === "value"){
      setValueCandidate(getValue());
    }
    setCurrEditAttrId(attrKey);
  };

  const pairClassNames = classNames(
    `attribute-name-value-pair ${attrKey}`,
    {"editing": editFacet === "name" || "value"}
  );

  const labelClassNames = classNames(
    `name ${attrKey}`,
    { "editing": editFacet === "name"}
  );

  const valueClassNames = classNames(
    `value ${attrKey}`,
    { "editing": editFacet === "value" }
  );

  const isDefaultLabel = looksLikeDefaultLabel(getLabel());
  const cellLabelClasses = classNames("cell-value", { "default-label": isDefaultLabel });
  return (
    <div className={pairClassNames}>
      <div className={labelClassNames} onClick={handleClick}>
        { !readOnly && editFacet === "name"
          ? <input
              type="text"
              value={labelCandidate}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={handleNameBlur}
            />
          : <div className={cellLabelClasses}>{getLabel()}</div>
        }
      </div>

      <div className={valueClassNames} onClick={handleClick}>
        { editFacet === "value" && !readOnly
          ? <input
              type="text"
              value={valueCandidate}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={handleCompleteValue}
            />
          : <div className="cell-value">{getValue()}</div>
        }
      </div>
    </div>
  );
});
