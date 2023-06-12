import { MathfieldElement } from 'mathlive';

export function replaceKeyBinding(bindings: any[], keyPress: string, command: string) {
  const index = bindings.findIndex(binding => binding.key === keyPress);
  if (index >= 0) {
    bindings[index].command = command;
  }
}

function getEditableStatus(mf: MathfieldElement) {
  let editableStatus: "empty" | "allSelected" | "someSelected"| "cursorInContent" | undefined;

  const exp = mf.value;
  const selStart = mf.selection.ranges[0][0];
  const selEnd = mf.selection.ranges[0][1];
  const pos = mf.position;

  const locale = pos === 0 ? "beginning"
    : (pos === exp.length || (pos === selEnd && pos === selStart) ? "end"
    : "middle");

  if (exp.length === 0 || exp === "\\placeholder" || exp === " ") editableStatus = "empty";
  else if (selStart === 0 && selEnd === exp.length) editableStatus = "allSelected";
  else if (selStart === 0 && selEnd === pos && pos !== selStart) editableStatus = "allSelected";
  else if (selStart !== selEnd) editableStatus = "someSelected";
  else if (selStart === selEnd && selStart === pos) editableStatus = "cursorInContent";
  else editableStatus = undefined;

  return editableStatus;
}

export function getMixedFractionCommandArray(mf: MathfieldElement ) {
  const editableStatus = getEditableStatus(mf);
  const ph = "\\placeholder{}";
  const emptyFrac = `\\frac{${ph}}{${ph}}}`;

  const replaceAll = editableStatus === "empty" || editableStatus === "allSelected";

  if (replaceAll){
    return ["insert", ph + emptyFrac, {insertionMode: "replaceAll"}]
  }

  else if (editableStatus === "cursorInContent") {
    return ["insert", `#@${emptyFrac}`, {insertionMode: "insertAfter"}]
  }

  else if (editableStatus === "someSelected") {
    return ["insert", `#@${emptyFrac}`, {insertionMode: "insertAfter"}]
  }

  else {
    return ["insert", `#@${emptyFrac}`, {insertionMode: "insertAfter"}]
  }

}
