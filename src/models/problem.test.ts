import { assert, expect } from "chai";
import { getSnapshot } from "mobx-state-tree";
import { ProblemModel } from "./problem";

describe("problem model", () => {

  it("has default values", () => {
    const problem = ProblemModel.create({
      name: "test",
    });
    assert.deepEqual(getSnapshot(problem), {
      name: "test",
      sections: [],
    });
  });

  it("uses override values", () => {
    const problem = ProblemModel.create({
        name: "test",
        sections: [
          {
            name: "first",
            shortName: "1",
          },
          {
            name: "second",
            shortName: "2",
          },
        ],
    });
    assert.deepEqual(getSnapshot(problem), {
      name: "test",
      sections: [
        {
          name: "first",
          shortName: "1",
        },
        {
          name: "second",
          shortName: "2",
        },
      ],
    });
  });

});
