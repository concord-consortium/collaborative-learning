import { assert } from "chai";
import { getSnapshot } from "mobx-state-tree";
import { ProblemModel } from "./problem";
import { SectionType } from "./section";
import { omitUndefined } from "../utilities/test-utils";

describe("problem model", () => {

  it("has default values", () => {
    const problem = ProblemModel.create({
      ordinal: 1,
      title: "test"
    });
    assert.deepEqual(getSnapshot(problem), {
      ordinal: 1,
      title: "test",
      subtitle: "",
      sections: []
    });
  });

  it("uses override values", () => {
    const problem = ProblemModel.create({
      ordinal: 1,
      title: "test",
      subtitle: "sub",
      sections: [
        {
          type: SectionType.introduction
        },
        {
          type: SectionType.initialChallenge
        }
      ]
    });
    assert.deepEqual(
      // omit undefined properties for comparison purposes
      omitUndefined(getSnapshot(problem)), {
      ordinal: 1,
      title: "test",
      subtitle: "sub",
      sections: [
        {
          type: SectionType.introduction,
          supports: []
        },
        {
          type: SectionType.initialChallenge,
          supports: []
        }
      ]
    });
  });

});
