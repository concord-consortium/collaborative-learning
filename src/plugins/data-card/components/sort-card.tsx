import React from "react";
import { ITileModel } from "../../../models/tiles/tile-model";
import { DataCardContentModelType } from "../data-card-content";

interface IProps {
  caseId: string;
  model: ITileModel;
  stackSpot: number;
}

export const SortCard: React.FC<IProps> = ({ model, caseId, stackSpot }) => {
  const content = model.content as DataCardContentModelType;

  return (
    <div className="card sortable">
      <div style={{ fontFamily: 'monospace', padding: "2px"}}>{caseId}</div>
    </div>
  );
};
