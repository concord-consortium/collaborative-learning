  /*
    Computes a good major tick value from a trial value. It will be the next
    lowest value of the form 1, 2, 5, 10, ...
    Patterned after CODAP's graph code
    @param {Number} range - the axis range
   */
  export function goodTickValue(range: number) {
    const trial = Math.abs(range / 5);

    // A zero trial means that the values we're going to plot either don't
    // exist or are all zero. Return 1 as an arbitrary choice.
    if (trial === 0) return [1, 4];

    // We move to base 10 so we can get rid of the power of ten.
    const logTrial = Math.log(trial) / Math.LN10;
    const floorTrial = Math.floor(logTrial);
    const powerTrial = Math.pow(10, floorTrial);

    // Whatever is left is in the range 1 to 10. Choose desired number
    let tBase = Math.pow(10, logTrial - floorTrial);

    if (tBase < 2) tBase = 1;
    else if (tBase < 5) tBase = 2;
    else tBase = 5;

    // number of minor ticks depends on the base used for the major ticks
    const minorTicks = tBase === 2 ? 1 : 4;

    // return [majorTickDistance, minorTicks]
    return [Math.max(powerTrial * tBase, Number.MIN_VALUE), minorTicks];
  }
