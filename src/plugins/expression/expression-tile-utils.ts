export function replaceKeyBinding(bindings: any[], keyPress: string, command: string) {
  const index = bindings.findIndex(binding => binding.key === keyPress);
  if (index >= 0) {
    bindings[index].command = command;
  }
}

// export function stripGroupedSlashes(str: string) {
//   return str.replace(/\{\/\}/g, '');
// }
