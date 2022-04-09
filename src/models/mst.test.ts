import { types } from "mobx-state-tree";

describe("mst", () => {
  it("does something weird with the snapshotProcessor", () => {
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
    // Is this really expected??
    expect(todo1b.text).toBe("todo2 text");
  });
});
