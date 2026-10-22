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
