export const kAnnotationNodeHeight = 24;
export const kAnnotationNodeWidth = 24;

export const halfPi = Math.PI / 2;
export const twoPi = Math.PI * 2;
export function normalizeAngle(angle: number) {
  let _angle = angle;
  while (_angle < 0) { _angle += twoPi; }
  while (_angle > twoPi) { _angle -= twoPi; }
  return _angle;
}

// Returns the default peak for a sparrow from sourceX, sourceY to targetX, targetY.
export function getDeafultPeak(sourceX: number, sourceY: number, targetX: number, targetY: number) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const mx = sourceX + dx / 2;
  const my = sourceY + dy / 2;
  const radius = Math.sqrt((dx / 2)**2 + (dy / 2)**2);
  const arrowAngle = normalizeAngle(Math.atan2(-dy, dx));

  const multiplier = arrowAngle > halfPi && arrowAngle < 3 * halfPi ? 1 : -1;
  const perpAngle = normalizeAngle(multiplier * Math.PI / 2 - arrowAngle);
  const peakDx = Math.cos(perpAngle) * radius;
  const peakDy = Math.sin(perpAngle) * radius;
  const peakX = mx + peakDx;
  const peakY = my + peakDy;
  return {
    peakDx, peakDy,
    peakX, peakY
  };
}
