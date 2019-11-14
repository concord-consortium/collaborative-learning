import { DataSetSelectionModel, SelectionStoreModel } from "./selection";

describe("DataSetSelectionModel", () => {

  const model = DataSetSelectionModel.create();

  it("works as expected", () => {
    expect(model.isSelected("foo")).toBe(false);
    expect(model.getSelected()).toEqual([]);
    model.select("foo", true);
    expect(model.isSelected("foo")).toBe(true);
    expect(model.getSelected()).toEqual(["foo"]);
    model.select("bar", false);
    expect(model.isSelected("foo")).toBe(true);
    expect(model.isSelected("bar")).toBe(false);
    expect(model.getSelected()).toEqual(["foo"]);
    model.toggleSelected("bar");
    expect(model.isSelected("foo")).toBe(true);
    expect(model.isSelected("bar")).toBe(true);
    expect(model.getSelected()).toEqual(["foo", "bar"]);
    model.setSelected(["bar", "roo"]);
    expect(model.isSelected("foo")).toBe(false);
    expect(model.isSelected("bar")).toBe(true);
    expect(model.isSelected("roo")).toBe(true);
    expect(model.getSelected()).toEqual(["bar", "roo"]);
  });

  it("can be observed", () => {
    const counts = {
            add: 0,
            update: 0,
            delete: 0
          } as { [name: string]: number };
    model.observe(change => {
      ++counts[change.type];
    });
    model.toggleSelected("bar");
    expect(counts).toEqual({ add: 0, update: 1, delete: 0 });
    const nodeCount = model.selection.size;
    model.clear();
    expect(counts).toEqual({ add: 0, update: 1, delete: nodeCount });
    model.select("baz", true);
    expect(counts).toEqual({ add: 1, update: 1, delete: nodeCount });
    model.setSelected(["bar", "baz"]);
    expect(counts).toEqual({ add: 2, update: 1, delete: nodeCount });
    model.clear();
    expect(counts).toEqual({ add: 2, update: 1, delete: nodeCount + 2 });
  });
});

describe("SelectionStoreModel", () => {

  const model = SelectionStoreModel.create();

  it("works as expected", () => {
    expect(model.isSelected("foo", "bar")).toBe(false);
    expect(model.getSelected("foo")).toEqual([]);
    model.select("foo", "bar", true);
    expect(model.isSelected("foo", "bar")).toBe(true);
    expect(model.getSelected("foo")).toEqual(["bar"]);
    model.toggleSelected("foo", "bar");
    expect(model.isSelected("foo", "bar")).toBe(false);
    expect(model.getSelected("foo")).toEqual([]);
    model.setSelected("foo", ["bar", "baz"]);
    expect(model.isSelected("foo", "bar")).toBe(true);
    expect(model.isSelected("foo", "baz")).toBe(true);
    expect(model.getSelected("foo")).toEqual(["bar", "baz"]);
    model.clear("foo");
    expect(model.isSelected("foo", "bar")).toBe(false);
    expect(model.isSelected("foo", "baz")).toBe(false);
    expect(model.getSelected("foo")).toEqual([]);
  });

  it("can be observed", () => {
    const counts = {
            add: 0,
            update: 0,
            delete: 0
          } as { [name: string]: number };
    model.observe("foo", change => {
      ++counts[change.type];
    });
    model.select("foo", "baz", true);
    expect(counts).toEqual({ add: 1, update: 0, delete: 0 });
    model.observe("baz", change => {
      ++counts[change.type];
    });
    model.select("baz", "roo", true);
    expect(counts).toEqual({ add: 2, update: 0, delete: 0 });
  });
});
