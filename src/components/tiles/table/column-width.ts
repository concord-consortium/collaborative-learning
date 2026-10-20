import { measureText } from "../hooks/use-measure-text";
import { kHeaderControlsReserve, kHeaderFont, kMaxAutoColumnWidth, kMinColumnWidth } from "./table-types";

/**
 * The width a column takes when nothing has set one: wide enough for its heading to sit on one
 * line, clear of the header controls, between the minimum and the cap.
 *
 * Only the heading is measured. Sizing to the data is a larger change -- the width would depend on
 * whichever rows happen to be loaded -- and is deliberately out of scope.
 */
export function headerFitWidth(name: string) {
  const fitted = measureText(name, kHeaderFont) + kHeaderControlsReserve;
  return Math.max(kMinColumnWidth, Math.min(kMaxAutoColumnWidth, fitted));
}
