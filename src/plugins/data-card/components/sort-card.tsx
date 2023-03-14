import React from "react";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";

interface IProps {
  caseId: string;
  model: ITileModel;
  indexInStack: number;
  totalInStack: number;
}

export const SortCard: React.FC<IProps> = ({ model, caseId, indexInStack, totalInStack }) => {
  const content = model.content as DataCardContentModelType;
  const deckCardNumberDisplay = content.dataSet.caseIndexFromID(caseId) + 1;
  const stackCardNumberDisplay = indexInStack + 1;

  return (
    <div className="card sortable">
      {caseId}<br/>
      { `${ stackCardNumberDisplay } of ${ totalInStack } cards in stack`}<br/>
      { `${ deckCardNumberDisplay } of ${ content.totalCases } cards in deck`}
    </div>
  );
};
