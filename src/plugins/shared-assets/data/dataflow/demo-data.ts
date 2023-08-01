// creates an array of values that ramps up linear from startVal to endVal, with arrLen steps
function fromTo(startVal: number, endVal: number, arrLen: number): number[] {
  const ints = [];
  const step = (endVal - startVal) / (arrLen - 1);
  for (let i = 0; i < arrLen; i++) {
    const val = Math.round(startVal + i * step);
    ints.push(val);
  }
  return ints;
}

// creates an array of values that base +/- noise, with arrLen steps
function noisyPlateau(base: number, noise: number, arrLen: number): number[] {
  const ints = [];
  for (let i = 0; i < arrLen; i++) {
    const val = base + (Math.random() * noise * 2) - noise;
    ints.push(Math.round(val));
  }
  return ints;
}

const slopeUpA = fromTo(40, 140, 10);
const slopeUpB = fromTo(140, 240, 7);
const slopeUpC = fromTo(240, 340, 5);
const slopeUpD = fromTo(340, 440, 2);

const slopeDownA = fromTo(440, 340, 2);
const slopeDownB = fromTo(340, 240, 5);
const slopeDownC = fromTo(240, 140, 7);
const slopeDownD = fromTo(140, 40, 10);

const holdClosed = noisyPlateau(440, 50, 180);
const holdOpen = noisyPlateau(40, 0, 30);


export const demoStreams = {
  "emgLongHold": [
    ...holdOpen,
    ...slopeUpA,
    ...slopeUpB,
    ...slopeUpC,
    ...slopeUpD,
    ...holdClosed, ...holdClosed,
    ...slopeDownA,
    ...slopeDownB,
    ...slopeDownC,
    ...slopeDownD,
    ...holdOpen
  ],
  "fsrSqueeze": [2,2,2,54,96,136,190,249,377,640,888,1023,
    1023,1023,1023,1023,925,779,625,424,175,2
  ]
};
