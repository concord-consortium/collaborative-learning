import { observer } from "mobx-react";
import React from "react";
import { useGraphModelContext } from "../../models/graph-model";
import AddSeriesIcon from "../../imports/assets/add-series-icon.svg";

export const AddSeriesButton = observer(function AddSeriesButton() {
  console.log("📁 add-series-button.tsx ------------------------");

  const graphModel = useGraphModelContext();
  const dataConfiguration = graphModel.config;

  function findUnplottedAttribute() {
    // Find first attribute in the dataset that is not shown in the graph
    // Returns undefined if there are none left.
    if (!graphModel || !dataConfiguration?.dataset) return;
    const datasetAttributes = dataConfiguration.dataset.attributes;
    const xAttributeId = dataConfiguration._attributeDescriptions.get('x')?.attributeID;
    // console.log("\t🥩 xAttributeId:", xAttributeId);
    const yAttributeIds = dataConfiguration.yAttributeDescriptions.map((a)=>a.attributeID);
    // console.log("\t🥩 yAttributeIds:", yAttributeIds);
    //
    // console.log("\t🔪 datasetAttributes.find((attr) => attr.id!==xAttributeId && !yAttributeIds.includes(attr.id));:",
    //             datasetAttributes.find((attr) => attr.id!==xAttributeId && !yAttributeIds.includes(attr.id)));

    return datasetAttributes.find((attr) => attr.id!==xAttributeId && !yAttributeIds.includes(attr.id));
  }

  function handleClick() {
    const first = findUnplottedAttribute();
    if (first && dataConfiguration.dataset) {
      graphModel.setAttributeID("yPlus", dataConfiguration.dataset.id, first.id);
    }
  }

  if (findUnplottedAttribute()) {
    return (
      <button onClick={handleClick} className="add-series-button">
        <AddSeriesIcon/>
        Add Series
      </button>
    );
  } else {
    return null;
  }
});


