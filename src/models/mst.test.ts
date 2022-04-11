import { types } from "mobx-state-tree";

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
});
