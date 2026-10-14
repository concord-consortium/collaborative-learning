import { onPatch } from "mobx-state-tree";
import { addAttributeToDataSet, addCasesToDataSet, DataSet, IDataSet } from "../../models/data/data-set";
import { kEventNumberAttrName, renumberEvents } from "./event-numbering";

describe("renumberEvents", () => {
  /** A dataset shaped like the Wave Runner's, with events given in the order supplied. */
  function eventsDataSet(startHours: number[]) {
    const dataSet = DataSet.create();
    addAttributeToDataSet(dataSet, { name: "eventType" });
    addAttributeToDataSet(dataSet, { name: "windowStart" });
    addAttributeToDataSet(dataSet, { name: "windowEnd" });
    addCasesToDataSet(dataSet, startHours.map(h => ({
      eventType: "Earthquake",
      windowStart: `2026-02-01T${String(h).padStart(2, "0")}:00:00.000Z`,
      windowEnd: `2026-02-01T${String(h).padStart(2, "0")}:30:00.000Z`
    })));
    return dataSet;
  }

  /** The event numbers, read back in the dataset's own case order. */
  function numbers(dataSet: IDataSet) {
    const attr = dataSet.attrFromName(kEventNumberAttrName);
    return dataSet.cases.map(c => dataSet.getStrValue(c.__id__, attr!.id));
  }

  it("adds the attribute, first, when the dataset has none", () => {
    const dataSet = eventsDataSet([1, 2]);
    renumberEvents(dataSet);
    expect(dataSet.attributes[0].name).toBe(kEventNumberAttrName);
  });

  it("marks the attribute as not editable, since it is derived", () => {
    const dataSet = eventsDataSet([1]);
    renumberEvents(dataSet);
    expect(dataSet.attrFromName(kEventNumberAttrName)!.editable).toBe(false);
  });

  it("numbers by time order, not the order the events were recorded", () => {
    const dataSet = eventsDataSet([5, 1, 3]);
    renumberEvents(dataSet);
    // Cases stay in their recorded order; the numbers describe time order.
    expect(numbers(dataSet)).toEqual(["3", "1", "2"]);
  });

  it("shifts the events after one that is inserted earlier in time", () => {
    const dataSet = eventsDataSet([1, 2]);
    renumberEvents(dataSet);
    addCasesToDataSet(dataSet, [
      { eventType: "Avalanche", windowStart: "2026-02-01T01:30:00.000Z",
        windowEnd: "2026-02-01T01:45:00.000Z" }
    ]);
    renumberEvents(dataSet);
    expect(numbers(dataSet)).toEqual(["1", "3", "2"]);
  });

  // Opening a document must not dirty it, and a run that appends in time order is the usual case.
  // The first call is asserted to write, so this cannot pass by never writing at all.
  it("writes on the first pass and nothing on the second", () => {
    const dataSet = eventsDataSet([1, 2, 3]);

    const firstPass: unknown[] = [];
    const stopWatchingFirst = onPatch(dataSet, patch => firstPass.push(patch));
    renumberEvents(dataSet);
    stopWatchingFirst();
    expect(firstPass.length).toBeGreaterThan(0);
    expect(numbers(dataSet)).toEqual(["1", "2", "3"]);

    const secondPass: unknown[] = [];
    onPatch(dataSet, patch => secondPass.push(patch));
    renumberEvents(dataSet);
    expect(secondPass).toEqual([]);
  });

  // setCaseValues resets the dataset's sort, so a renumber with nothing to change must not call
  // it at all: a student who sorted the table should not have that undone behind them when the
  // next day of a run is recorded.
  it("leaves a sorted dataset's sort alone when there is nothing to renumber", () => {
    const dataSet = eventsDataSet([1, 2, 3]);
    renumberEvents(dataSet);
    const typeAttrId = dataSet.attrFromName("eventType")!.id;
    dataSet.sortCases(typeAttrId, "DESC");

    renumberEvents(dataSet);

    expect(dataSet.sortDirection).toBe("DESC");
    expect(dataSet.sortByAttribute).toBe(typeAttrId);
  });

  // The Timeline draws a case only when both times parse and the type is non-empty, so numbering
  // has to skip exactly the same ones or a case nobody can see shifts the numbers of ones they can.
  it.each([
    ["an unusable windowStart", { eventType: "Noise", windowStart: "", windowEnd: "2026-02-01T01:00:00.000Z" }],
    ["an unusable windowEnd", { eventType: "Noise", windowStart: "2026-02-01T00:30:00.000Z", windowEnd: "" }],
    ["no event type", { eventType: "", windowStart: "2026-02-01T00:30:00.000Z",
                        windowEnd: "2026-02-01T01:00:00.000Z" }]
  ])("numbers a case the Timeline skips for %s after the ones it draws", (_label, extraCase) => {
    const dataSet = eventsDataSet([2]);
    addAttributeToDataSet(dataSet, { name: "windowEnd" });
    addCasesToDataSet(dataSet, [extraCase]);
    renumberEvents(dataSet);
    // The drawn event keeps number 1 even though the skipped case starts earlier.
    expect(numbers(dataSet)).toEqual(["1", "2"]);
  });

  it("does nothing to a dataset that is not events", () => {
    const dataSet = DataSet.create();
    addAttributeToDataSet(dataSet, { name: "height" });
    renumberEvents(dataSet);
    expect(dataSet.attrFromName(kEventNumberAttrName)).toBeUndefined();
  });
});
