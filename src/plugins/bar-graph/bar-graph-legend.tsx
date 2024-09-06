import React from 'react';
import { observer } from 'mobx-react';
import { useBarGraphModelContext } from './bar-graph-content-context';

import RemoveDataIcon from "../../assets/remove-data-icon.svg";

export const BarGraphLegend = observer(function BarGraphLegend () {
  const model = useBarGraphModelContext();

  function unlinkDataset() {
    if (model) {
      model.unlinkDataSet();
    }
  }


  if (!model || !model.dataSet) {
    return null;
  }

  return (
    <div className="bar-graph-legend">
      <div className="dataset-header">
        <div className="dataset-icon">
          <a onClick={unlinkDataset} aria-label={`Unlink ${model.dataSet.name}`}>
            <RemoveDataIcon/>
          </a>
        </div>
        <div className="dataset-label">
          <span className="dataset-label-text">Data from:</span>
          <span className="dataset-name">{model.dataSet.name}</span>
        </div>
      </div>

      <div className="sort-by">
        Sort by:
      </div>
    </div>
  );
});
