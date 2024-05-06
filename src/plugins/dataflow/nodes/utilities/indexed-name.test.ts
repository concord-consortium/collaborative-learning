import { getNewIndexedName } from "../rete-manager";

describe('Indexed Name Test', () => {
  it('should return the correct indexed name', () => {
    const testCases = [
      { existingNames: ["Sensor 1", "Sensor 2"],
        baseName: "Sensor",
        expected: "Sensor 3"
      },
      { existingNames: ["Sensor 1", "Sensor 3"],
        baseName: "Sensor",
        expected: "Sensor 4"
      },
      { existingNames: ["Sensor 2", "Generator 3", "Sensor 3"],
        baseName: "Sensor",
        expected: "Sensor 4"
      },
      { existingNames: ["Sensor 2", "Generator 3", "Sensor 3"],
        baseName: "Generator",
        expected: "Generator 4"
      },
      { existingNames: ["Timer", "Timer  3", "Timer 5"],
        baseName: "Timer",
        expected: "Timer 6"
      },
      { existingNames: ["Timer", "Timer3"],
        baseName: "Timer",
        expected: "Timer 4"
      },
      { existingNames: ["4", "Foo", " "],
        baseName: "Timer",
        expected: "Timer 1"
      },
      { existingNames: ["Foo", "Foo 3.3"],
        baseName: "Foo",
        expected: "Foo 4"
      },
      { existingNames: ["Timer", "Timer 3.93"],
        baseName: "Timer",
        expected: "Timer 4"
      }
    ];

    testCases.forEach(testCase => {
      const { existingNames, baseName, expected } = testCase;
      const result = getNewIndexedName(existingNames, baseName);
      expect(result).toBe(expected);
    });
  });
});
