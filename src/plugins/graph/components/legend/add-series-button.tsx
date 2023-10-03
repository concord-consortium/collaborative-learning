import { observer } from "mobx-react";
import React, {useRef} from "react";
import { useDataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { IAttributeDescriptionSnapshot } from "../../models/data-configuration-model";




export const AddSeriesButton = observer(function AddSeriesButton() {
  const dataConfiguration = useDataConfigurationContext();
  // console.log("📁add-series-button.tsx-------------------------");
  // console.log("\t🏭<AddSeriesButton>");
  const divRef = useRef<HTMLDivElement>(null);
  // console.log("\t🔪divRef", divRef);

  function handleClick() {
    // Find first unplotted attribute
    if (!dataConfiguration || !dataConfiguration.dataset) return;
    const datasetAttributes = dataConfiguration.dataset.attributes;
    const plottedAttributeIds = dataConfiguration.uniqueAttributes;
    const first = datasetAttributes.find((attr) => !plottedAttributeIds.includes(attr.id));
    if (first) {
      // console.log('Adding first unused attribute: ', first.name, first.id);
      const toAdd: IAttributeDescriptionSnapshot = {
        attributeID: first.id
      };
      dataConfiguration.addYAttribute(toAdd);
      // console.log('After add, y attributes are: ', dataConfiguration.yAttributeDescriptions);
    } else {
      // console.log('No attributes are unplotted');
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
      <div ref={divRef}>
        <button onClick={handleClick} className="add-series-button" >Add Series</button>
      </div>
    );
  } else {

    return null;
  }
});


