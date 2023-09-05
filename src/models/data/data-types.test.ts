import { isDate, isImageUrl, isNumeric } from "./data-types";
import dayjs from "dayjs";

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
describe("dayjs", () => {
  const valuesToTest: string[] = [
    "2/23",
    "some string with a date 2/23",
    "extra chars between 2/nb23"
  ];
  test("non strict, no format", () => {
    const testCases = valuesToTest.map(value => {
      return [value, dayjs(value).isValid()];
    });
    expect({ testCases }).toMatchInlineSnapshot(`
"2/23" => true
"some string with a date 2/23" => true
"extra chars between 2/nb23" => false
`);
  });
  test("non strict, format", () => {
    // Note: data-types.ts extends dayjs so we don't have to do that here
    const testCases = valuesToTest.map(value => {
      return [value, dayjs(value, "M/D").isValid()];
    });
    expect({ testCases }).toMatchInlineSnapshot(`
"2/23" => true
"some string with a date 2/23" => true
"extra chars between 2/nb23" => true
`);
  });
  test("strict, format", () => {
    // Note: data-types.ts extends dayjs so we don't have to do that here
    const testCases = valuesToTest.map(value => {
      return [value, dayjs(value, "M/D", true).isValid()];
    });
    expect({ testCases }).toMatchInlineSnapshot(`
"2/23" => true
"some string with a date 2/23" => false
"extra chars between 2/nb23" => false
`);
  });
});


describe("data-types", () => {
  test("isDate", () => {
    const valuesToTest: string[] = [
      "2/3",
      "2/3/76",
      "2/3/1976",
      "2/03",
      "2/03/76",
      "2/03/1976",
      "02/3",
      "02/3/76",
      "02/3/1976",
      "02/03",
      "02/03/76",
      "02/03/1976",
      "Feb 3",
      "Feb 3, 76",
      "Feb 3, 1976",
      "Feb 03",
      "Feb 03, 76",
      "Feb 03, 1976",
      "February 3",
      "February 3, 76",
      "February 3, 1976",
      "February 03",
      "February 03, 76",
      "February 03, 1976",
      "2 / 3",
      "Feb3,1976",
      "02-23-1976",
      // invalid dates
      "02/30/1976",
      "23/02/1976",
      "23/02",
      "123",
      "ccimg://fbrtdb.concord.org/democlass1/-NdC3tVdE70ngANCam6q"
    ];
    const testCases = valuesToTest.map(value => {
      return [value, isDate(value)];
    });
    expect({ testCases }).toMatchInlineSnapshot(`
"2/3" => true
"2/3/76" => true
"2/3/1976" => true
"2/03" => true
"2/03/76" => true
"2/03/1976" => true
"02/3" => true
"02/3/76" => true
"02/3/1976" => true
"02/03" => true
"02/03/76" => true
"02/03/1976" => true
"Feb 3" => true
"Feb 3, 76" => true
"Feb 3, 1976" => true
"Feb 03" => true
"Feb 03, 76" => true
"Feb 03, 1976" => true
"February 3" => true
"February 3, 76" => true
"February 3, 1976" => true
"February 03" => true
"February 03, 76" => true
"February 03, 1976" => true
"2 / 3" => true
"Feb3,1976" => true
"02-23-1976" => true
"02/30/1976" => false
"23/02/1976" => false
"23/02" => false
"123" => false
"ccimg://fbrtdb.concord.org/democlass1/-NdC3tVdE70ngANCam6q" => false
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
      "2,000",
      "1,200,000.00",
      // ⬇ This should really not be considered a number in the US locale
      //    However the current comma handling approach is simple so this
      //    is considered the same as 12
      "1,2"
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
"2,000" => true
"1,200,000.00" => true
"1,2" => true
`);
  });
});
