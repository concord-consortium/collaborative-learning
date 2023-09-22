import { MathfieldElement } from 'mathlive';
import { SelectStatus, InsertModeString, expressionButtonsList } from './expression-types';

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
  const button = expressionButtonsList.find(b => b.name === buttonName);
  const insertString = button?.baseLatex;

  let insertMode: InsertModeString = "replaceAll";
  if (selectStatus === "cursor") insertMode = "insertAfter";
  if (selectStatus === "some") insertMode = "replaceSelection";

  return ["insert", insertString, { insertionMode: insertMode }];
}
