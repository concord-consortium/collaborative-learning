import { observer } from "mobx-react";
import React from "react";
import { useGraphModelContext } from "../../models/graph-model";

export const AddSeriesButton = observer(function AddSeriesButton() {
  const graphModel = useGraphModelContext();
  const dataConfiguration = graphModel.config;
  console.log("----<AddSeriesButton>--------");
  console.log("🚀 ~ file: add-series-button.tsx:8 ~ AddSeriesButton ~ dataConfiguration:", dataConfiguration);

  function handleClick() {
    console.log("🚀 ~ file: add-series-button.tsx:12 ~ handleClick ~ handleClick:", handleClick);
    // Find first unplotted attribute
    if (!graphModel || !dataConfiguration || !dataConfiguration.dataset) return;
    const datasetAttributes = dataConfiguration.dataset.attributes;
    const plottedAttributeIds = dataConfiguration.uniqueAttributes;
    const first = datasetAttributes.find((attr) => !plottedAttributeIds.includes(attr.id));
    if (first) {
      graphModel.setAttributeID("yPlus", dataConfiguration.dataset.id, first.id);
    } else {
      console.log('No attributes are unplotted');
    }
  }

  let hasUnplottedAttributes = false;
  if (dataConfiguration) {
    const dataset = dataConfiguration.dataset;
    if (dataset) {
      const datasetAttributes = dataset.attributes;
      const plottedAttributeIds = dataConfiguration.uniqueAttributes;
      if (datasetAttributes.length > plottedAttributeIds.length) hasUnplottedAttributes = true;
    }
  }

  if (hasUnplottedAttributes) {
    return (
      <button onClick={handleClick} className="add-series-button">Add Series</button>
    );
  } else {
    return null;
  }
});


