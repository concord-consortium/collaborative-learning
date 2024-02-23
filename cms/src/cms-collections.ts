import { CmsConfig, CmsField } from "netlify-cms-core";
import { urlParams } from "../../src/utilities/url-params";
import { AppConfigModel, AppConfigModelSnapshot } from "../../src/models/stores/app-config-model";
import appConfigJson from "../../src/clue/app-config.json";
import { UnitModelType, getUnitJson } from "../../src/models/curriculum/unit";

const appConfig = AppConfigModel.create(appConfigJson as AppConfigModelSnapshot);
const unit = urlParams.unit ?? "sas";
let unitJson: Promise<UnitModelType> | undefined;

getUnitJson(unit, appConfig).then((json) => {
  unitJson = json;
  getCmsCollections();
});

export function getCmsCollections(){
  console.log("| getCmsCollections returning config based on unitJson |", unitJson);
  // TODO: why is below succeeding in surfacing "Teacher Guides" as a section type?
  return  [{
    name: "sections",
    label: "Curriculum Sections",
    label_singular: "Curriculum Section",
    identifier_field: "type",
    format: "json",
    folder: urlParams.unit ? `curriculum/${urlParams.unit}` : `curriculum`,
    nested: {
      depth: 6,
    },
    fields: [
      {
        label: "Type",
        name: "type",
        widget: "string"
      },
      {
        label: "Preview Link",
        name: "preview-link",
        required: false,
        widget: "preview-link"
      } as CmsField,
      {
        label: "Content",
        name: "content",
        widget: "clue" as any
      }
    ],
  }] as CmsConfig["collections"];
}
