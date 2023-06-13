import { MathfieldElement } from 'mathlive';

const ph = "\\placeholder{}";
const emptyFrac = `\\frac{${ph}}{${ph}}}`;
const mixedFrac = `${ph}\\frac{${ph}}{${ph}}`
const divSign = "\\div";
const multSign = "\\times";
const divisionEmpty = `${ph}${divSign}${ph}`;
const multEmpty = `${ph}${multSign}${ph}`;

type SelectStatus = "empty" | "all" | "some" | "cursor" | undefined;
type InsertModeString = "replaceAll" | "insertAfter" | "replaceSelection";

export function replaceKeyBinding(bindings: any[], keyPress: string, command: string) {
  const index = bindings.findIndex(binding => binding.key === keyPress);
  if (index >= 0) {
    bindings[index].command = command;
  }
}

function getSelectStatus(mf: MathfieldElement): SelectStatus {
  const exp = mf.value;
  const selStart = mf.selection.ranges[0][0];
  const selEnd = mf.selection.ranges[0][1];
  const pos = mf.position;

  if (exp.length === 0 || exp === "\\placeholder" || exp === " ") return "empty";
  if (selStart === 0 && selEnd === pos && pos !== 0 ) return "all";
  if (selStart !== selEnd)  return "some";
  if (selStart === selEnd && selStart === pos)  return "cursor";
  return undefined;
}

export function getCommand(mf: MathfieldElement, buttonName: string) {
  const selectStatus = getSelectStatus(mf);

  const insertString = buttonName === "mixedFraction" ? mixedFrac : divisionEmpty;

  let insertMode: InsertModeString = "replaceAll";
  if (selectStatus === "cursor") insertMode = "insertAfter";
  if (selectStatus === "some") insertMode = "replaceSelection";

  return ["insert", insertString, {insertionMode: insertMode}]
}

// export function getDivisionCommandArray(mf: MathfieldElement){
//   const SelectStatus = getSelectStatus(mf);
//   return ["insert", `#@${ph}${divSign}${ph}`, {insertionMode: "replaceAll"}]
// }