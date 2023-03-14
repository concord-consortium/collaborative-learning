import React from "react";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { SortCard } from "./sort-card";
import classNames from "classnames";
import { gImageMap } from "../../../models/image-map";

interface IProps {
  stackValue: string;
  inAttributeId: string;
  model: ITileModel;
}

// TODO improve this to break on nearest word ending
const getStackValueDisplay = (value: string) => {
  if(value === "") return "(no value)";
  if(gImageMap.isImageUrl(value)) return "(image)";
  if(value.length < 14) return value;
  return value.slice(0, 13) + '... ';
};

export const SortStack: React.FC<IProps> = ({ model, stackValue, inAttributeId }) => {
  const content = model.content as DataCardContentModelType;
  const caseIds = content.caseIdsFromAttributeValue(inAttributeId, stackValue);
  const units = caseIds.length > 1 ? "cards" : "card";
  const stackValueDisplay = getStackValueDisplay(stackValue);
  const stackClasses = classNames("stack-cards", inAttributeId);

  return (
    <div className="stack cell" /*style={{ height: "290px"}}*/>
      <div className="stack-heading">
         {stackValueDisplay}: {caseIds.length} {units}
      </div>
      <div className={stackClasses}>
        {
          caseIds.map((cid, i) => {
            return <SortCard
              key={cid}
              model={model}
              caseId={cid}
              indexInStack={i}
              totalInStack={caseIds.length}
            />;
          })
        }
      </div>
    </div>
  );
};

export const SortStackPlaceholder: React.FC = () => {
  return <div className="empty cell"></div>;
};
