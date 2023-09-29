import { isDate, isImageUrl, isNumeric, toNumeric } from "./data-types";
import dayjs from "dayjs";

// JSON.stringify is nice because it adds quotes around strings
// But things like NaN and Infinity not written out correctly
function niceString(value: any) {
  if (typeof value === "number" && !isFinite(value)){
    return value.toString();
  }
  return JSON.stringify(value);
}

expect.addSnapshotSerializer({
  serialize(val, config, indentation, depth, refs, printer) {
    return val.testCases.map(([inputValue, result]: [any, any]) =>
      `${niceString(inputValue)} => ${niceString(result)}`)
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
      "2/3/76",
      "2/3/1976",
      "2/03/76",
      "2/03/1976",
      "02/3/76",
      "02/3/1976",
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
      "2 / 3 / 76",
      "Feb3,1976",
      "02-23-1976",

      // **** Invalid Dates *****

      // The following group is invalid because we support fractions
      "2/3",
      "2/03",
      "02/3",
      "02/03",

      // These are not real date on the calendar
      "02/30/1976",
      "23/02/1976",
      "23/02",

      // Numbers are not considered dates
      "123",

      // This image was causing a problem before
      "ccimg://fbrtdb.concord.org/democlass1/-NdC3tVdE70ngANCam6q"
    ];
    const testCases = valuesToTest.map(value => {
      return [value, isDate(value)];
    });
    expect({ testCases }).toMatchInlineSnapshot(`
"2/3/76" => true
"2/3/1976" => true
"2/03/76" => true
"2/03/1976" => true
"02/3/76" => true
"02/3/1976" => true
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
"2 / 3" => false
"2 / 3 / 76" => true
"Feb3,1976" => true
"02-23-1976" => true
"2/3" => false
"2/03" => false
"02/3" => false
"02/03" => false
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

  describe("numeric handling", () => {
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
      "1/2",
      "22/33",
      "-1/4",
      "1 / 4",
      "-1 / 4",
      " -1",
      " -1 ",
      " - 1/4",

      // Invalid numbers: only certain fractions are allowed
      "1 1/4",
      "1/3/4",
      "1.0/2.0",
      "-1/-2",
      "1+1",
      "1*1",
      // ⬇ This should really not be considered a number in the US locale
      //    However the current comma handling approach is simple so this
      //    is considered the same as 12
      "1,2",

      // Strings become null
      "a",
      "hello"
    ];

    test("toNumeric", () => {
      const testCases = valuesToTest.map(value => {
        return [value, toNumeric(value)];
      });
      expect({ testCases }).toMatchInlineSnapshot(`
"" => NaN
"123" => 123
"1E10" => 10000000000
"1e10" => 10000000000
"1 E10" => NaN
"1E 10" => NaN
"1 E 10" => NaN
"-1.0" => -1
"0xFF" => 255
"0o10" => 8
"0b10" => 2
"2,000" => 2000
"1,200,000.00" => 1200000
"1/2" => 0.5
"22/33" => 0.6666666666666666
"-1/4" => -0.25
"1 / 4" => 0.25
"-1 / 4" => -0.25
" -1" => -1
" -1 " => -1
" - 1/4" => -0.25
"1 1/4" => NaN
"1/3/4" => NaN
"1.0/2.0" => NaN
"-1/-2" => NaN
"1+1" => NaN
"1*1" => NaN
"1,2" => 12
"a" => NaN
"hello" => NaN
`);
    });


    test("isNumeric", () => {
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
"1/2" => true
"22/33" => true
"-1/4" => true
"1 / 4" => true
"-1 / 4" => true
" -1" => true
" -1 " => true
" - 1/4" => true
"1 1/4" => false
"1/3/4" => false
"1.0/2.0" => false
"-1/-2" => false
"1+1" => false
"1*1" => false
"1,2" => true
"a" => false
"hello" => false
`);
    });

  });
});
