import { NodeOperationTypes } from './node';

describe('NodeOperationTypes', () => {
  it('should return the correct values for round, ceil, and floor methods', () => {
    const testCases = [
      { input: -1.8,  round: -2,  floor: -2,  ceil: -1 },
      { input: -1.2,  round: -1,  floor: -2,  ceil: -1 },
      { input: -0.8,  round: -1,  floor: -1,  ceil: 0 },
      { input: -0.2,  round: 0,   floor: -1,  ceil: 0 },
      { input: 0,     round: 0,   floor: 0,   ceil: 0 },
      { input: 0.2,   round: 0,   floor: 0,   ceil: 1 },
      { input: 0.8,   round: 1,   floor: 0,   ceil: 1 },
      { input: 1,     round: 1,   floor: 1,   ceil: 1 },
      { input: 1.2,   round: 1,   floor: 1,   ceil: 2 },
      { input: 1.8,   round: 2,   floor: 1,   ceil: 2 }
    ];

    NodeOperationTypes.forEach(operation => {
      if (['Round', 'Ceil', 'Floor'].includes(operation.name)) {
        testCases.forEach(testCase => {
          const { input, round, floor, ceil } = testCase;
          const result = operation.method(input, 0);
          switch (operation.name) {
            case 'Round':
              expect(result).toBeCloseTo(round);

              break;
            case 'Floor':
              expect(result).toBeCloseTo(floor);
              break;
            case 'Ceil':
              expect(result).toBeCloseTo(ceil);
              break;
            default:
              break;
          }
        });
      }
    });
  });
});
