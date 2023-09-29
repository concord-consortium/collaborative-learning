import { observer } from "mobx-react";
import React from "react";
import { useDataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { IAttributeDescriptionSnapshot } from "../../models/data-configuration-model";

export const AddSeriesButton = observer(function AddSeriesButton() {
  const dataConfiguration = useDataConfigurationContext();
  console.log("----<AddSeriesButton>--------");
  console.log("🚀 ~ file: add-series-button.tsx:8 ~ AddSeriesButton ~ dataConfiguration:", dataConfiguration);

  function handleClick() {
    console.log("🚀 ~ file: add-series-button.tsx:12 ~ handleClick ~ handleClick:", handleClick);
    // Find first unplotted attribute
    if (!dataConfiguration || !dataConfiguration.dataset) return;
    const datasetAttributes = dataConfiguration.dataset.attributes;
    const plottedAttributeIds = dataConfiguration.uniqueAttributes;
    const first = datasetAttributes.find((attr) => !plottedAttributeIds.includes(attr.id));
    if (first) {
      console.log('Adding first unused attribute: ', first.name, first.id);
      const toAdd: IAttributeDescriptionSnapshot = {
        attributeID: first.id
      };
      dataConfiguration.addYAttribute(toAdd);
      console.log('After add, y attributes are: ', dataConfiguration.yAttributeDescriptions);
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


