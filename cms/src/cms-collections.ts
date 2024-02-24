import { CmsConfig, CmsField } from "netlify-cms-core";
import { urlParams } from "../../src/utilities/url-params";
import { AppConfigModel, AppConfigModelSnapshot } from "../../src/models/stores/app-config-model";
import appConfigJson from "../../src/clue/app-config.json";
import { getUnitJson } from "../../src/models/curriculum/unit";

const appConfig = AppConfigModel.create(appConfigJson as AppConfigModelSnapshot);
const unit = urlParams.unit ?? "sas";
let unitJson: any;

getUnitJson(unit, appConfig).then((json) => {
  unitJson = json;
  getCmsCollections();
});

const defaultConfiguration = [{
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
}];

const newConfiguration = [{
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
}];

export function getCmsCollections(){
  if (!unitJson) return defaultConfiguration as CmsConfig["collections"];
  if (unitJson.code === "moth") {
    return newConfiguration as CmsConfig["collections"];
  } else {
    return defaultConfiguration as CmsConfig["collections"];
  }
}
