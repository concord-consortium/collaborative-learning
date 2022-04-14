import { getType, isType, types } from "mobx-state-tree";

describe("mst", () => {
  it("snapshotProcessor unexpectedly modifies the base type", () => {
    const Todo1 = types.model({ text: types.maybe(types.string) });
    const Todo2 = types.snapshotProcessor(Todo1, {
      preProcessor(sn) {
        return {text: "todo2 text"};
      }
    });
    const todo1a = Todo1.create();
    expect(todo1a.text).toBeUndefined();

    const todo2 =Todo2.create();
    expect(todo2.text).toBe("todo2 text");

    const todo1b = Todo1.create();
    // When the type created by the snapshotProcessor (Todo2) is instantiated,
    // the base type's (Todo1's) create method is modified so it actually goes 
    // through the processor. This is bug in MST and has been reported here:
    // https://github.com/mobxjs/mobx-state-tree/issues/1897
    expect(todo1b.text).toBe("todo2 text");
  });

  it("snapshotProcessor type matches type check of original type", () => {
    const Todo1 = types.model({ text: types.maybe(types.string) });
    const Todo2 = types.snapshotProcessor(Todo1, {
      preProcessor(sn) {
        return {text: "todo2 text"};
      }
    });
    const todo2 =Todo2.create();
    expect(getType(todo2) === Todo1).toBe(true);
  });

  it("loads late types when another type referencing is instantiated", () => {
    let lateCalled = false;
    const TypeWithLate = types.model("TypeWithLate", {
      prop: types.late(() => {
        lateCalled = true;
        return types.string;
      })
    });
    expect(lateCalled).toBe(false);

    const TypeUsingLate = types.model("TypeUsingLate", {
      withLate: TypeWithLate
    });
    expect(lateCalled).toBe(false);

    TypeUsingLate.create({withLate: {prop: "val"}});
    expect(lateCalled).toBe(true);
  });

  it("loads a late type immediately when it is the direct child of a map", () => {        
    let lateCalled = false;
    types.model("TypeWithLate", {
      prop: types.map(types.late(() => {
        lateCalled = true;
        return types.string;
      }))
    });
    expect(lateCalled).toBe(true);
  });

  it("loads a late type immediately when it is the direct child of an optional", () => {        
    let lateCalled = false;
    types.model("TypeWithLate", {
      prop: types.optional(types.late(() => {
        lateCalled = true;
        return types.string;
      }), "something")
    });
    expect(lateCalled).toBe(true);
  });

  it("delays loading a late type when it is the direct child of a maybe", () => {        
    let lateCalled = false;
    const TypeWithLate = types.model("TypeWithLate", {
      prop: types.maybe(types.late(() => {
        lateCalled = true;
        return types.string;
      }))
    });
    expect(lateCalled).toBe(false);

    TypeWithLate.create({});
    expect(lateCalled).toBe(true);
  });

  it("delays loading a late type child of a map when the map is wrapped in late", () => {        
    let lateCalled = false;
    const TypeWithLate = types.model("TypeWithLate", {
      prop: types.late(() => types.map(types.late(() => {
        lateCalled = true;
        return types.string;
      })))
    });
    expect(lateCalled).toBe(false);

    TypeWithLate.create({prop: {"hi": "hello"}});
    expect(lateCalled).toBe(true);
  });

  it("delays loading a late type when inside of a map of models with a late prop", () => {
    let lateCalled = false;
    const TypeWithLate = types.model("TypeWithLate", {
      prop: types.late(() => {
        lateCalled = true;
        return types.string;
      })
    });
    expect(lateCalled).toBe(false);

    const TypeUsingLate = types.model("TypeUsingLate", {
      withLateMap: types.map(TypeWithLate)
    });
    expect(lateCalled).toBe(false);

    TypeUsingLate.create({withLateMap: {}});
    expect(lateCalled).toBe(false);

    TypeUsingLate.create({withLateMap: {"key": {prop: "value"}}});
    expect(lateCalled).toBe(true);
  });
});
