import { addAttributeToDataSet, addCasesToDataSet, IDataSet } from "../../models/data/data-set";
import { evaluateFormulas } from "../../models/formula/formula-test-harness";
import { SharedDataSet } from "../../models/shared/shared-data-set";
import { addEventNumberColumn, kEventNumberAttrName } from "./event-number-column";

interface TestEvent { windowStart: string; windowEnd?: string; eventType?: string }

/** A shared dataset shaped like the Wave Runner's, numbered and evaluated as a document would be. */
function eventsDataSet(events: TestEvent[]) {
  const sharedDataSet = SharedDataSet.create();
  const dataSet: IDataSet = sharedDataSet.dataSet;
  ["eventType", "windowStart", "windowEnd", "confidence", "modelLabel"]
    .forEach(name => addAttributeToDataSet(dataSet, { name }));
  addCasesToDataSet(dataSet, events.map(evt => ({
    eventType: evt.eventType ?? "Earthquake",
    windowStart: evt.windowStart,
    windowEnd: evt.windowEnd ?? "2026-02-01T23:59:00.000Z"
  })));
  addEventNumberColumn(dataSet);
  evaluateFormulas(sharedDataSet);
  return dataSet;
}

/** An hour of the test day, as the Wave Runner writes it. */
const at = (hour: number, minute = 0) =>
  `2026-02-01T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;

/** The event numbers, read back in the dataset's own case order. */
function numbers(dataSet: IDataSet) {
  const attr = dataSet.attrFromName(kEventNumberAttrName)!;
  return dataSet.cases.map(c => dataSet.getStrValue(c.__id__, attr.id));
}

describe("addEventNumberColumn", () => {
  it("adds the column first, so a linked table leads with it", () => {
    const dataSet = eventsDataSet([{ windowStart: at(1) }]);
    expect(dataSet.attributes[0].name).toBe(kEventNumberAttrName);
  });

  it("leaves an existing column alone rather than adding a second or resetting its formula", () => {
    const dataSet = eventsDataSet([{ windowStart: at(1) }]);
    dataSet.attrFromName(kEventNumberAttrName)!.setFormula("rank(windowEnd)");

    addEventNumberColumn(dataSet);

    expect(dataSet.attributes.filter(a => a.name === kEventNumberAttrName)).toHaveLength(1);
    expect(dataSet.attrFromName(kEventNumberAttrName)!.formula.display).toBe("rank(windowEnd)");
  });
});

describe("the Event Number column", () => {
  it("numbers by time order, not the order the events were recorded", () => {
    expect(numbers(eventsDataSet([{ windowStart: at(5) }, { windowStart: at(1) }, { windowStart: at(3) }])))
      .toEqual(["3", "1", "2"]);
  });

  // The Timeline requires a valid start, a non-empty end and a type. A case it skips must not take
  // a number, or every event the student can see after it would be numbered one too high.
  it.each([
    ["no event type", { windowStart: at(0, 30), eventType: "" }],
    ["a blank windowEnd", { windowStart: at(0, 30), windowEnd: "" }],
    ["an unparseable windowStart", { windowStart: "sometime", windowEnd: at(1) }]
  ])("gives no number to an event the Timeline skips for %s", (_label, skipped: TestEvent) => {
    expect(numbers(eventsDataSet([{ windowStart: at(2) }, skipped]))).toEqual(["1", ""]);
  });

  it("numbers a tied pair consecutively in case order, as the Timeline does", () => {
    expect(numbers(eventsDataSet([{ windowStart: at(3) }, { windowStart: at(3) }, { windowStart: at(1) }])))
      .toEqual(["2", "3", "1"]);
  });

  it("closes the gap when a linked table deletes an earlier event", () => {
    const dataSet = eventsDataSet([{ windowStart: at(1) }, { windowStart: at(3) }, { windowStart: at(5) }]);
    dataSet.removeCases([dataSet.cases[0].__id__]);
    expect(numbers(dataSet)).toEqual(["1", "2"]);
  });

  it("renumbers when a linked table re-times an event past another", () => {
    const dataSet = eventsDataSet([{ windowStart: at(5) }, { windowStart: at(3) }]);
    const startAttrId = dataSet.attrFromName("windowStart")!.id;
    dataSet.setCanonicalCaseValues([{ __id__: dataSet.cases[0].__id__, [startAttrId]: at(2) }]);
    expect(numbers(dataSet)).toEqual(["1", "2"]);
  });

  // The Data Card writes straight to the dataset, bypassing every guard a tile could put up.
  it("recomputes a number written over it from outside", () => {
    const dataSet = eventsDataSet([{ windowStart: at(1) }, { windowStart: at(3) }]);
    const numberAttrId = dataSet.attrFromName(kEventNumberAttrName)!.id;
    dataSet.setCanonicalCaseValues([{ __id__: dataSet.cases[0].__id__, [numberAttrId]: 99 }]);
    expect(numbers(dataSet)).toEqual(["1", "2"]);
  });
});
