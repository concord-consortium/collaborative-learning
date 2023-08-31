// creates an array of len values, with values increasing linearly from startVal to endVal
function fromTo(startVal: number, endVal: number, len: number): number[] {
  const ints = [];
  const step = (endVal - startVal) / (len - 1);
  for (let i = 0; i < len; i++) {
    const val = Math.round(startVal + i * step);
    ints.push(val);
  }
  return ints;
}

// creates an array of len values, where each is base +/- noise
function noisyPlateau(base: number, noise: number, len: number): number[] {
  const ints = [];
  for (let i = 0; i < len; i++) {
    const val = base + (Math.random() * noise * 2) - noise;
    ints.push(Math.round(val));
  }
  return ints;
}

const slopeUpA = fromTo(40, 140, 3);
const slopeUpB = fromTo(140, 240, 3);
const slopeUpC = fromTo(240, 340, 2);
const slopeUpD = fromTo(340, 440, 1);

const slopeDownA = fromTo(440, 340, 1);
const slopeDownB = fromTo(340, 240, 2);
const slopeDownC = fromTo(240, 140, 3);
const slopeDownD = fromTo(140, 40, 3);

const holdClosed = noisyPlateau(440, 50, 180);
const holdOpen = noisyPlateau(40, 0, 30);

export const demoStreams = {
  "emgLongHold": [
    ...holdOpen,
    ...slopeUpA, ...slopeUpB, ...slopeUpC, ...slopeUpD,
    ...holdClosed, ...holdClosed,
    ...slopeDownA, ...slopeDownB, ...slopeDownD, ...slopeDownC,
    ...holdOpen
  ],
  "fsrSqueeze": [2,2,2,54,96,136,190,249,377,640,888,1023,
    1023,1023,1023,1023,925,779,625,424,175,2
  ],
  "fastBoil": [
    20, 20.5, 21, 21.5, 22, 22.5, 23, 23.5, 24, 24.5, 25, 25.5, 26, 26.5, 27, 27.5, 28,
    28.5, 29, 29.5, 30, 30.5, 31, 31.5, 32, 32.5, 33, 33.5, 34, 34.5, 35, 35.5, 36, 36.5, 37, 37.5, 38,
    38.5, 39, 39.5, 40, 40.5, 41, 41.5, 42, 42.5, 43, 43.5, 44, 44.5, 45, 45.5, 46, 46.5, 47, 47.5, 48,
    48.5, 49, 49.5, 50, 50.5, 51, 51.5, 52, 52.5, 53, 53.5, 54, 54.5, 55, 55.5, 56, 56.5, 57, 57.5, 58,
    58.5, 59, 59.5, 60, 60.5, 61, 61.5, 62, 62.5, 63, 63.5, 64, 64.5, 65, 65.5, 66, 66.5, 67, 67.5, 68,
    68.5, 69, 69.5, 70, 70.5, 71, 71.5, 72, 72.5, 73, 73.5, 74, 74.5, 75, 75.5, 76, 76.5, 77, 77.5, 78,
    78.5, 79, 79.5, 80, 80.5, 81, 81.5, 82, 82.5, 83, 83.5, 84, 84.5, 85, 85.5, 86, 86.5, 87, 87.5, 88,
    88.5, 89, 89.5, 90, 90.5, 91, 91.5, 92, 92.5, 93, 93.5, 94, 94.5, 95, 95.5, 96, 96.5, 97, 97.5, 98,
    98.5, 99, 99.5, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100
  ]
};
