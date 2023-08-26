import { isDate, isImageUrl, isNumeric } from "./data-types";

expect.addSnapshotSerializer({
  serialize(val, config, indentation, depth, refs, printer) {
    return val.testCases.map(([inputValue, result]: [any, any]) =>
      `${JSON.stringify(inputValue)} => ${JSON.stringify(result)}`)
    .join("\n");
  },
  // Look for a value that has a testCases key with a value of an array
  test(val: any): boolean {
    return val?.testCases?.length > 0;
  }
});

// run `npm run test -- -u data-types.test` to update the snapshots in this file

describe("data-types", () => {
  test("isDate", () => {
    const valuesToTest: string[] = [
      "2/3",
      "2 / 3",
      "02/23/1976",
      "02/23/76",
      "23/02/1976",
      "02/31/1976",
      "02/32/1976",
      "02-23-1976",
      "02/23",
      "23/02",
      "123"
    ];
    const testCases = valuesToTest.map(value => {
      return [value, isDate(value)];
    });
    expect({ testCases }).toMatchInlineSnapshot(`
"2/3" => true
"2 / 3" => true
"02/23/1976" => true
"02/23/76" => true
"23/02/1976" => true
"02/31/1976" => true
"02/32/1976" => true
"02-23-1976" => true
"02/23" => true
"23/02" => true
"123" => false
`);
  });

  test("isImageUrl", () => {
    const valuesToTest: string[] = [
      "https://something.concord.org/hello.png",
      "ccimg://fbrtdb.concord.org/hello.png",
      "ccimg://fbrtdb.concord.org/anything.txt",
      "ccimg://not-a-cc.domain.com/hello.png",
      "random.string.com/"
    ];
    const testCases = valuesToTest.map(value => {
      return [value, isImageUrl(value)];
    });
    expect({ testCases }).toMatchInlineSnapshot(`
"https://something.concord.org/hello.png" => false
"ccimg://fbrtdb.concord.org/hello.png" => true
"ccimg://fbrtdb.concord.org/anything.txt" => true
"ccimg://not-a-cc.domain.com/hello.png" => false
"random.string.com/" => false
`);
  });

  test("isNumeric", () => {
    const valuesToTest: string[] = [
      "",
      "123",
      "1E10",
      "1e10",
      "1 E10",
      "1E 10",
      "1 E 10",
      "-1.0",
      "0xFF",
      "0o10",
      "0b10",
      "2,000" // <-- this should be a number but is not
    ];
    const testCases = valuesToTest.map(value => {
      return [value, isNumeric(value)];
    });
    expect({ testCases }).toMatchInlineSnapshot(`
"" => false
"123" => true
"1E10" => true
"1e10" => true
"1 E10" => false
"1E 10" => false
"1 E 10" => false
"-1.0" => true
"0xFF" => true
"0o10" => true
"0b10" => true
"2,000" => false
`);
  });
});
