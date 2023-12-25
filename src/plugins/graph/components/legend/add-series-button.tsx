import React from "react";
import { observer } from "mobx-react";
import { useDataConfigurationContext } from "../../hooks/use-data-configuration-context";
import AddSeriesIcon from "../../imports/assets/add-series-icon.svg";

export const AddSeriesButton = observer(function AddSeriesButton() {
  const dataConfiguration = useDataConfigurationContext();

  function findUnplottedAttribute() {
    // Find first attribute in the dataset that is not shown in the graph
    // Returns undefined if there are none left.
    if (!dataConfiguration?.dataset) return;
    const datasetAttributes = dataConfiguration.dataset.attributes;
    const xAttributeId = dataConfiguration._attributeDescriptions.get('x')?.attributeID;
    const yAttributeIds = dataConfiguration.yAttributeDescriptions.map((a)=>a.attributeID);
    return datasetAttributes.find((attr) => attr.id!==xAttributeId && !yAttributeIds.includes(attr.id));
  }

  function handleClick() {
    const first = findUnplottedAttribute();
    if (first && dataConfiguration?.dataset) {
      dataConfiguration.addYAttribute({attributeID: first.id});
    }
  }

  if (findUnplottedAttribute()) {
    return (
      <button onClick={handleClick} className="add-series-button">
        <div className="legend-icon">
          <AddSeriesIcon/>
        </div>
        <div className="add-series-label">
          Add Series
        </div>
      </button>
    );
  } else {
    return null;
  }
});


