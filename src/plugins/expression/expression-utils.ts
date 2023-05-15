export function replaceKeyBinding(bindings: any[], keyPress: string, command: string) {
  const index = bindings.findIndex(binding => binding.key === keyPress);
  if (index >= 0) {
    bindings[index].command = command;
  }
}

export function discoverKeyBindings(bindings: any[], keyPress: string) {
  const index = bindings.findIndex(binding => binding.key === keyPress);
  if (index >= 0) {
    return bindings[index].command;
  }
  return "";
}

export function discoverOS() {
  const userAgent = window.navigator.userAgent;
  if (userAgent.indexOf("CrOS") !== -1) return "ChromeOS";
  if (userAgent.indexOf("Windows") !== -1) return "Windows";
  if (userAgent.indexOf("Mac") !== -1) return "Mac";
  if (userAgent.indexOf("Linux") !== -1) return "Linux";
  return "Unknown";
}