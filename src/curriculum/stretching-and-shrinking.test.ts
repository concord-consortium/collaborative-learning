import { assert } from "chai";
import { SnapshotIn } from "mobx-state-tree";
import { CurriculumModel } from "../models/curriculum";
import { SectionModelType, SectionType } from "../models/section";
import * as curriculumJson from "./stretching-and-shrinking.json";
import { each, isObject } from "lodash";

function replaceSectionTypes(obj: {}): SnapshotIn<typeof CurriculumModel> {
  each(obj, (v, k) => {
    if ((k === "type") && (SectionType[v] != null)) {
      (obj as SectionModelType).type = SectionType[v] as SectionType;
    }
    else if (isObject(v)) {
      replaceSectionTypes(v);
    }
  });
  return obj as SnapshotIn<typeof CurriculumModel>;
}

describe("stretching and shrinking sample curriculum module", () => {

  it("reads successfully", () => {
    const processedJson = replaceSectionTypes(curriculumJson);
    const curriculum = CurriculumModel.create(processedJson);
    assert(curriculum != null);
  });

});
