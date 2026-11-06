import { IPlotScale } from "../dataflow-node-plot-types";

export const kServoMinAngle = 0;
export const kServoMaxAngle = 180;

/**
 * The angle a servo takes for `value`, matching the live Servo output.
 *
 * In proportion mode -- the `settings.dataflow.servoInputMode` a unit may set -- an input of 0 to
 * 1 covers the whole sweep; otherwise the input is already degrees. Either way the result is
 * clamped, so an out-of-range input parks at the nearer end instead of running past it.
 */
export function servoAngleForValue(value: number, proportionMode: boolean) {
  const scaled = proportionMode ? value * kServoMaxAngle : value;
  return Math.min(Math.max(scaled, kServoMinAngle), kServoMaxAngle);
}

const servoPercent = (angle: number) => (angle / kServoMaxAngle) * 100;

/** How a servo minigraph is drawn: the units its field reads, and the full travel as the axis. */
export function servoPlotScale(proportionMode: boolean): IPlotScale {
  return proportionMode
    ? { toPlot: servoPercent, min: 0, max: 100 }
    : { min: kServoMinAngle, max: kServoMaxAngle };
}

/**
 * The Servo output field label. The stored value is always the angle in degrees (0-180). In degrees
 * mode (default) it is shown as degrees; in proportion mode as % of full rotation, mirroring the
 * gripper's "% closed".
 */
export function servoDisplayMessage(value: number, proportionMode: boolean) {
  if (proportionMode) return `${Math.round(servoPercent(value))}% rotation`;
  return `${Math.round(value)}°`;
}
