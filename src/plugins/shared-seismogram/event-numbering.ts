import { DateTime } from "luxon";
import { addAttributeToDataSet, ICase, IDataSet } from "../../models/data/data-set";

// The table shows an attribute's name as its column header, so this is the heading the student
// reads: "Event Number", as the story asks, not a camelCase key.
export const kEventNumberAttrName = "Event Number";

/**
 * Numbers every event by its place in `windowStart` order and writes the numbers into `dataSet`,
 * adding the attribute if it is missing. Call it after anything changes which events exist.
 *
 * The number has to be data rather than a row position: the table can be sorted, and the Timeline
 * numbers by time, so a row index would disagree with it the moment a student sorted by type.
 */
export function renumberEvents(dataSet: IDataSet) {
  const startAttr = dataSet.attrFromName("windowStart");
  if (!startAttr) return;

  if (!dataSet.attrFromName(kEventNumberAttrName)) {
    // First, so it is the first column of any table showing this data, and not editable, because
    // the next renumber would overwrite anything typed into it.
    addAttributeToDataSet(dataSet, { name: kEventNumberAttrName, editable: false },
                          dataSet.attributes[0]?.id);
  }
  const numberAttr = dataSet.attrFromName(kEventNumberAttrName);
  if (!numberAttr) return;

  // The Timeline draws a case only when both of its times parse and its type is non-empty (see
  // `events` in timeline-content.ts). Numbering has to apply the same rule: a case the Timeline
  // skips would otherwise take a number and shift every event drawn after it.
  const endAttr = dataSet.attrFromName("windowEnd");
  const typeAttr = dataSet.attrFromName("eventType");
  const parses = (caseId: string, attrId: string) =>
    DateTime.fromISO(dataSet.getStrValue(caseId, attrId)).isValid;
  const isTimelineEvent = (caseId: string) =>
    parses(caseId, startAttr.id) &&
    !!endAttr && parses(caseId, endAttr.id) &&
    !!typeAttr && !!dataSet.getStrValue(caseId, typeAttr.id);

  // Anything the Timeline skips sorts after everything it draws, so it still gets a number for the
  // table without disturbing the numbers the student sees on the graph.
  const sortKey = (caseId: string) => isTimelineEvent(caseId)
    ? DateTime.fromISO(dataSet.getStrValue(caseId, startAttr.id)).toMillis()
    : Number.POSITIVE_INFINITY;

  const inTimeOrder = dataSet.cases.map(c => c.__id__)
                        .sort((a, b) => sortKey(a) - sortKey(b));

  // Only what changes is written: merely opening a document must not dirty it, and a run that
  // appends in time order leaves every existing number alone.
  const changed: ICase[] = [];
  inTimeOrder.forEach((caseId, i) => {
    const eventNumber = i + 1;
    if (Number(dataSet.getStrValue(caseId, numberAttr.id)) !== eventNumber) {
      // Keyed by attribute name: setCaseValues looks the key up in attrNameMap, and silently
      // writes nothing for a key it cannot find there. setCanonicalCaseValues is the id-keyed one.
      changed.push({ __id__: caseId, [kEventNumberAttrName]: eventNumber });
    }
  });
  if (changed.length) dataSet.setCaseValues(changed, [numberAttr.id]);
}
