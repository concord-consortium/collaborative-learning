import React from "react";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";
import { SortCard } from "./sort-card";

interface IProps {
  stackValue: string;
  inAttributeId: string;
  model: ITileModel;
}

export const SortStack: React.FC<IProps> = ({ model, stackValue, inAttributeId }) => {
  const content = model.content as DataCardContentModelType;
  const caseIds = content.caseIdsWithAttributeValue(inAttributeId, stackValue);
  const units = caseIds.length > 1 ? "cards" : "card";
  const stackValueDisplay = stackValue !== "" ? stackValue : "(no value)"
  return (
    <div className="stack cell">
      <div className="stack-heading">
        {stackValueDisplay}: {caseIds.length} {units}
      </div>
      <div className="stack-cards">
        {
          caseIds.map((cid, i) => {
            return <SortCard
              key={cid}
              model={model}
              caseId={cid}
              stackSpot={i}
            />
          })
        }
      </div>
    </div>
  );
};

export const SortStackPlaceholder: React.FC = () => {
  return <div className="empty cell"></div>;
};
