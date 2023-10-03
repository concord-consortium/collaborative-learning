import { observer } from "mobx-react";
import React from "react";
import { useGraphModelContext } from "../../models/graph-model";

export const AddSeriesButton = observer(function AddSeriesButton() {
  const graphModel = useGraphModelContext();
  const dataConfiguration = graphModel.config;
  console.log("----<AddSeriesButton>--------");
  console.log("🚀 ~ file: add-series-button.tsx:8 ~ AddSeriesButton ~ dataConfiguration:", dataConfiguration);

  function findUnplottedAttribute() {
    // Find first attribute in the dataset that is not shown in the graph
    // Returns undefined if there are none left.
    if (!graphModel || !dataConfiguration || !dataConfiguration.dataset) return;
    const datasetAttributes = dataConfiguration.dataset.attributes;
    // It seems like dataConfiguration.uniqueAttributes ought to work here, but it doesn't return all the Y's
    const xAttributeId = dataConfiguration._attributeDescriptions.get('x')?.attributeID;
    const yAttributeIds = dataConfiguration.yAttributeDescriptions.map((a)=>a.attributeID);
    return datasetAttributes.find((attr) => attr.id!==xAttributeId && !yAttributeIds.includes(attr.id));
  }

  function handleClick() {
    console.log("🚀 ~ file: add-series-button.tsx:12 ~ handleClick ~ handleClick:", handleClick);
    const first = findUnplottedAttribute();
    if (first && dataConfiguration.dataset) {
      graphModel.setAttributeID("yPlus", dataConfiguration.dataset.id, first.id);
    } else {
      console.log('No attributes are unplotted');
    }
    console.log('Y attributres are now: ', dataConfiguration.yAttributeDescriptions.map(d=>d.attributeID));
  }

  if (findUnplottedAttribute()) {
    return (
      <button onClick={handleClick} className="add-series-button">Add Series</button>
    );
  } else {
    return null;
  }
});


