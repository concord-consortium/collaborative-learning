import { getNewIndexedName } from "./indexed-name";

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
      },
      // Real display names contain regex metacharacters — see NodeTypes' "Timer (on/off)". Without
      // escaping the stem, `(on/off)` became a capture group and every new node was named " 1".
      { existingNames: ["Timer (on/off) 1"],
        baseName: "Timer (on/off)",
        expected: "Timer (on/off) 2"
      },
      { existingNames: ["Timer (on/off) 1", "Timer (on/off) 3"],
        baseName: "Timer (on/off)",
        expected: "Timer (on/off) 4"
      },
      // The stem must still match literally rather than as a pattern.
      { existingNames: ["Timer XonY 2"],
        baseName: "Timer (on/off)",
        expected: "Timer (on/off) 1"
      }
    ];

    testCases.forEach(testCase => {
      const { existingNames, baseName, expected } = testCase;
      const result = getNewIndexedName(existingNames, baseName);
      expect(result).toBe(expected);
    });
  });
});
