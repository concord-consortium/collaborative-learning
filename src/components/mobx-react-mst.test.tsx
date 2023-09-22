import React from "react";
import { render, screen } from "@testing-library/react";
import { destroy, detach, IAnyStateTreeNode, Instance, types } from "mobx-state-tree";
import { observer } from "mobx-react";
import { observable } from "mobx";
import { verifyAlive } from "../utilities/mst-utils";

function destroySoon(obj: IAnyStateTreeNode) {
  // Using detach instead of destroy prevents the harmless errors. However it
  // will then also not catch the harmful errors that can happen when the object
  // is detached before it is destroyed.
  detach(obj);
  setTimeout(() => destroy(obj));
}

function initialize() {
  const log = [] as string[];
  const descriptions: Record<string, string> = observable({
    one: "description1",
    two: "description2"
  });

  const Item = types.model("Item", {
    name: types.string
  })
  .views(self => ({
    get nameWithDescription() {
      const name = self.name;
      log.push(`computedValue called on ${name}`);
      const description = descriptions[name];
      return `${name}: ${description}`;
    }
  }));

  const List = types.model("List", {
    items: types.array(Item)
  })
  .actions(self => ({
    removeFirstItem() {
      const todo = self.items[0];
      destroy(todo);
    },
    removeFirstDescriptionAndItem() {
      const todo = self.items[0];
      delete descriptions[todo.name];
      destroy(todo);
    },
    removeFirstDescriptionAndItemSoon() {
      const todo = self.items[0];
      delete descriptions[todo.name];
      destroySoon(todo);
    }
  }));

  const ItemComponent = observer(function ItemComponent(
    { item }: { item: Instance<typeof Item> }
  ) {
    log.push(`ItemComponent rendering ${item.name}`);
    return <div>{item.nameWithDescription}</div>;
  });

  const ListComponent = observer(function ListComponent(
    { list }: { list: Instance<typeof List> }
  ) {
    log.push("ListComponent rendering");
    return (
      <ol>{ list.items.map((item) =>
        <li key={item.name}><ItemComponent item={item}/></li>
      )}
      </ol>
    );
  });

  return {
    Item,
    List,
    ItemComponent,
    ListComponent,
    descriptions,
    itemList: List.create({
      items: [
        { name: "one" },
        { name: "two" }
      ]
    }),
    // Used to track each calls to illustrate what is happening
    log,
    clearLog() {
      log.length = 0;
    }
  };

}

const initialLog = [
  "ListComponent rendering",
  "ItemComponent rendering one",
  "computedValue called on one",
  "ItemComponent rendering two",
  "computedValue called on two",
];

describe("behavior of mobx-react with mst objects", () => {
  it("updates a list when items are destroyed", () => {
    const { List, ListComponent, log, clearLog } = initialize();
    const list = List.create({
      items: [ { name: "one" }, { name: "two" }]
    });

    render(<ListComponent list={list}/>);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items.map(item => item.textContent)).toEqual(["one: description1", "two: description2"]);
    expect(log).toEqual(initialLog);
    clearLog();

    list.removeFirstItem();

    const itemsAfterRemove = screen.getAllByRole("listitem");
    expect(itemsAfterRemove).toHaveLength(1);
    expect(itemsAfterRemove.map(item => item.textContent)).toEqual(["two: description2"]);

    expect(log).toEqual([
      "ListComponent rendering"
    ]);
  });

  it("updates a list and prints warning with removeFirstDescriptionAndItem", () => {
    const { List, ListComponent, log, clearLog } = initialize();
    const list = List.create({
      items: [ { name: "one" }, { name: "two" }]
    });

    render(<ListComponent list={list}/>);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items.map(item => item.textContent)).toEqual(["one: description1", "two: description2"]);
    expect(log).toEqual(initialLog);
    clearLog();

    jestSpyConsole("warn", spy => {
      list.removeFirstDescriptionAndItem();
      expect(spy).toHaveBeenCalled();
    });

    const itemsAfterRemove = screen.getAllByRole("listitem");
    expect(itemsAfterRemove).toHaveLength(1);
    expect(itemsAfterRemove.map(item => item.textContent)).toEqual(["two: description2"]);
    // Note how the computedValue is called, but the ItemComponent isn't rendered
    expect(log).toEqual([
      "computedValue called on one",
      "ListComponent rendering"
    ]);
  });

  it("updates a list and doesn't print warning with removeFirstDescriptionAndItem and isAlive short circuit", () => {
    const { List, Item, log, clearLog } = initialize();
    const testList = List.create({
      items: [ { name: "one" }, { name: "two" }]
    });

    const ItemComponent = observer(function ItemComponent(
      { item }: { item: Instance<typeof Item> }
    ) {
      log.push(`ItemComponent rendering ${item.name}`);
      // Note: we aren't bailing out here. Just checking if
      // the item is alive before item.nameWithDescription is
      // enough to short circuit MobX's shouldCompute.
      // shouldCompute finds the dependencies have changed so it returns
      // true. But the component is never rendered because the parent
      // component only renders active (alive) children.
      verifyAlive(item, "ItemComponent");
      return <div>{item.nameWithDescription}</div>;
    });

    const ListComponent = observer(function ListComponent(
      { list }: { list: Instance<typeof List> }
    ) {
      log.push("ListComponent rendering");
      return (
        <ol>{ list.items.map((item) =>
          <li key={item.name}><ItemComponent item={item}/></li>
        )}
        </ol>
      );
    });

    render(<ListComponent list={testList}/>);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items.map(item => item.textContent)).toEqual(["one: description1", "two: description2"]);
    expect(log).toEqual(initialLog);
    clearLog();

    jestSpyConsole("warn", spy => {
      testList.removeFirstDescriptionAndItem();
      expect(spy).not.toHaveBeenCalled();
    });

    const itemsAfterRemove = screen.getAllByRole("listitem");
    expect(itemsAfterRemove).toHaveLength(1);
    expect(itemsAfterRemove.map(item => item.textContent)).toEqual(["two: description2"]);
    // Note how the computedValue is no longer called, and ItemComponent still isn't rendered
    expect(log).toEqual([
      "ListComponent rendering"
    ]);
  });

  it("updates a list and doesn't print warning with removeFirstDescriptionAndItemSoon", () => {
    const { List, ListComponent, log, clearLog } = initialize();
    const testList = List.create({
      items: [ { name: "one" }, { name: "two" }]
    });

    render(<ListComponent list={testList}/>);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items.map(item => item.textContent)).toEqual(["one: description1", "two: description2"]);
    expect(log).toEqual(initialLog);
    clearLog();

    jestSpyConsole("warn", spy => {
      testList.removeFirstDescriptionAndItemSoon();
      expect(spy).not.toHaveBeenCalled();
    });

    const itemsAfterRemove = screen.getAllByRole("listitem");
    expect(itemsAfterRemove).toHaveLength(1);
    expect(itemsAfterRemove.map(item => item.textContent)).toEqual(["two: description2"]);
    // Note how the computedValue is still called.
    // There is no warning, but because computedValue is called
    // the computed function might make an assumption the item
    // is still valid or part of the tree. This could cause an
    // immediate error or warning. Or it might have some side effect
    // that doesn't show up until later.
    expect(log).toEqual([
      "computedValue called on one",
      "ListComponent rendering"
    ]);
  });
});
