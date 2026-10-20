import { addAttributeToDataSet, IDataSet } from "../../models/data/data-set";

// The table shows an attribute's name as its column header, so this is the heading the student
// reads: "Event Number", as the story asks, not a camelCase key.
export const kEventNumberAttrName = "Event Number";

// The Timeline draws a case only when both of its times parse and its type is non-empty (see
// `events` in timeline-content.ts), and numbers what it draws in `windowStart` order. The filter
// holds this column to the same events, as nearly as the formula language's date parsing matches
// luxon's: they agree on every ISO form, and differ only on formats a student would have to type
// on purpose, such as `Feb 1, 2026`.
const kEventNumberFormula =
  `rank(windowStart, isDate(windowStart) and isDate(windowEnd) and eventType != "")`;

/**
 * Gives `dataSet` an "Event Number" column, first, holding each event's place in time order.
 *
 * It is a formula column, so the formula engine keeps it right on its own: nobody has to renumber
 * after a linked table adds, deletes or re-times an event, and a value typed over it is recomputed
 * away. That makes adding it a one-time structural change, and doing it twice would overwrite a
 * formula the student may have since edited.
 *
 * The formula is how the numbers stay right, not something the student wrote, so the column is
 * marked derived: to them it is one of the event's values, like its type or its start time, and a
 * table shows it as an ordinary column.
 */
export function addEventNumberColumn(dataSet: IDataSet) {
  if (dataSet.attrFromName(kEventNumberAttrName)) return;

  addAttributeToDataSet(dataSet, { name: kEventNumberAttrName, derived: true },
                        dataSet.attributes[0]?.id);
  dataSet.attrFromName(kEventNumberAttrName)?.setFormula(kEventNumberFormula);
}
