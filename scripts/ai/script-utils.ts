// _duration should be in miliseconds
export function prettyDuration(_duration: number) {
  const miliseconds = _duration % 1000;
  const totalSeconds = Math.floor(_duration / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const hourPart = hours > 0 ? `${hours}:` : "";
  const minutePart = hourPart || minutes > 0 ? `${minutes}:` : "";
  const secondPart = minutePart || seconds > 0 ? `${seconds}.` : "";
  return `${hourPart}${minutePart}${secondPart}${miliseconds}`;
}

export function getFirebaseBasePath(portal: string, demo?: string | boolean) {
  return demo
    ? `demo/${demo}/documents`
    : `authed/${portal.replace(/\./g, "_")}/documents`;
}
