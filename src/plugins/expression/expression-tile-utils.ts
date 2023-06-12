import { MathfieldElement } from 'mathlive';

export function replaceKeyBinding(bindings: any[], keyPress: string, command: string) {
  const index = bindings.findIndex(binding => binding.key === keyPress);
  if (index >= 0) {
    bindings[index].command = command;
  }
}

function getEditableStatus(mf: MathfieldElement): string | undefined {
  const exp = mf.value;
  const selStart = mf.selection.ranges[0][0];
  const selEnd = mf.selection.ranges[0][1];
  const pos = mf.position;

  console.log("| getEditableStatus |",
    "\n selStart: ", selStart,
    "\n selEnd: ", selEnd,
    "\n pos: ", pos,
    "\n exp.length: ", exp.length,
  );

  if (exp.length === 0 || exp === "\\placeholder" || exp === " ") return "empty";
  if (selStart === 0 && selEnd === pos && pos !== 0 ) return "all";
  if (selStart !== selEnd)  return "some";
  if (selStart === selEnd && selStart === pos)  return "cursor";
  return undefined;
}

export function getMixedFractionCommandArray(mf: MathfieldElement ) {
  const editableStatus = getEditableStatus(mf);
  console.log("|editableStatus|", editableStatus)
  const ph = "\\placeholder{}";
  const emptyFrac = `\\frac{${ph}}{${ph}}}`;

  switch (editableStatus) {
    case "empty":
      return ["insert", `#@${emptyFrac}`, { insertionMode: "replaceAll" }];

    case "all":
      return ["insert", `#@${emptyFrac}`, { insertionMode: "replaceAll" }];

    case "cursor":
      return ["insert", `#@${emptyFrac}`, { insertionMode: "insertAfter" }];

    case "some":
      // TODO - you implemented this in an earlier version, reimplement it here
      console.log("| selection ", mf.selection.ranges[0][0], mf.selection.ranges[0][1])
      //return ["insert", `#@${emptyFrac}`, { insertionMode: "insertBefore" }];

    default:
      return ["insert", `#@${emptyFrac}`, { insertionMode: "insertAfter" }];
  }
}

/**
 *
 * [ X ] empty
 * [ X ] all
 * [  ] someSelected
 * [ x ] cursorInContent
 */

export function getDivisionCommandArray(mf: MathfieldElement){
  const editableStatus = getEditableStatus(mf);
  const ph = "\\placeholder{}";
  const divSign = "\\div";
  return ["insert", `#@${ph}${divSign}${ph}`, {insertionMode: "replaceAll"}]
}