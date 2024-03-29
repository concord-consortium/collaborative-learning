import { getParentWithTypeName } from "./mst-utils";
import { types, unprotect } from "mobx-state-tree";

// reduce mobx strictness just for this test so we can use unprotect 
// without seeing a warning
// I'd note that the MST jest tests themselves have this same problem and they 
// have not disabled the warning. An example test is here:
//   https://github.com/mobxjs/mobx-state-tree/blob/master/packages/mobx-state-tree/__tests__/core/node.test.ts#L35
import {configure} from "mobx"; configure({ enforceActions: "never" });

describe("getParentWithTypeName", () => {

  it("works with direct child", () => {

    const ChildModel = types.model("ChildModel", {});
    const ParentModel = types.model("ParentModel", {
      child: ChildModel
    });

    const child = ChildModel.create();
    const parent = ParentModel.create({ child });

    const result = getParentWithTypeName(child, "ParentModel");
    expect(result).toEqual(parent);
  });

  it("works with intermediate node", () => {

    const ChildModel = types.model("ChildModel", {});
    const ParentModel = types.model("ParentModel", {
      child: ChildModel
    });
    const GrandParentModel = types.model("GrandParentModel", {
      child: ParentModel
    });

    const child = ChildModel.create();
    const parent = ParentModel.create({ child });
    const grandParent = GrandParentModel.create({ child: parent });

    const result = getParentWithTypeName(child, "GrandParentModel");
    expect(result).toEqual(grandParent);
  });

  it("works with intermediate array", () => {
    const ChildModel = types.model("ChildModel", {});
    const ParentModel = types.model("ParentModel", {
      children: types.optional(types.array(ChildModel), [])
    });

    const child = ChildModel.create();
    const parent = ParentModel.create();
    // The parent is being modified outside of an action so it needs to be unprotected
    unprotect(parent);
    parent.children.push(child);

    const result = getParentWithTypeName(child, "ParentModel");
    expect(result).toEqual(parent);
  });

  it("returns undefined with a parentless child", () => {
    const ChildModel = types.model("ChildModel", {});

    const child = ChildModel.create();

    const result = getParentWithTypeName(child, "ParentModel");
    expect(result).toBeUndefined();
  });

  it("returns undefined with an unmatched parent", () => {
    const ChildModel = types.model("ChildModel", {});
    const ParentModel = types.model("ParentModel", {
      child: ChildModel
    });

    const child = ChildModel.create();
    ParentModel.create({ child });

    const result = getParentWithTypeName(child, "OtherModel");
    expect(result).toBeUndefined();
  });

});
