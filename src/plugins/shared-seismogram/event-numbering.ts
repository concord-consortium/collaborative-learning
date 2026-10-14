import { DateTime } from "luxon";
import { addAttributeToDataSet, ICase, IDataSet } from "../../models/data/data-set";

export const kEventNumberAttrName = "eventNumber";

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

  // An event whose windowStart will not parse sorts last, matching the Timeline, which leaves such
  // a case out of `events` entirely.
  const startMs = (caseId: string) => {
    const time = DateTime.fromISO(dataSet.getStrValue(caseId, startAttr.id));
    return time.isValid ? time.toMillis() : Number.POSITIVE_INFINITY;
  };

  const inTimeOrder = dataSet.cases.map(c => c.__id__)
                        .sort((a, b) => startMs(a) - startMs(b));

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
