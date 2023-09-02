export const halfPi = Math.PI / 2;
export const twoPi = Math.PI * 2;
export function normalizeAngle(angle: number) {
  let _angle = angle;
  while (_angle < 0) { _angle += twoPi; }
  while (_angle > twoPi) { _angle -= twoPi; }
  return _angle;
}
