// Returns the default peak for a sparrow from sourceX, sourceY to targetX, targetY.
export function getDeafultPeak(sourceX: number, sourceY: number, targetX: number, targetY: number) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const mx = sourceX + dx / 2;
  const my = sourceY + dy / 2;
  const radius = Math.sqrt((dx / 2)**2 + (dy / 2)**2);
  const arrowAngle = Math.atan2(-dy, dx);

  const perpAngle = -Math.PI / 2 - arrowAngle;
  const peakDx = Math.cos(perpAngle) * radius;
  const peakDy = Math.sin(perpAngle) * radius;
  const peakX = mx + peakDx;
  const peakY = my + peakDy;
  return {
    peakDx, peakDy,
    peakX, peakY
  };
}
