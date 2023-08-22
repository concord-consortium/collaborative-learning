import { Attribute, IAttributeSnapshot } from "./attribute";
import { clone } from "lodash";

// run `npm run test -- -u attribute.test` to update the snapshots in this file

function replacer(key: string, value: any) {
  if(value instanceof Map) {
    return [...value];
  } else {
    return value;
  }
}

// This should only apply to this test file, so it shouldn't mess up other tests
// To be extra sure it requires the `testCases` key.
expect.addSnapshotSerializer({
  serialize(val, config, indentation, depth, refs, printer) {
    return val.testCases.map(([inputValue, result]: [any, any]) =>
      `${JSON.stringify(inputValue)} => ${JSON.stringify(result, replacer)}`)
    .join("\n");
  },
  // Look for a value that has a testCases key with a value of an array
  test(val: any): boolean {
    return val?.testCases?.length > 0;
  }
});

describe("DataSet Attributes", () => {
  test("Basic attribute functionality", () => {
    const attribute = Attribute.create({ name: "foo" } as any);
    expect(attribute.id).toBeDefined();
    expect(attribute.name).toBe("foo");
    expect(attribute.length).toBe(0);

    const copy = clone(attribute);
    expect(copy.id).toBe(attribute.id);
    expect(copy.name).toBe(attribute.name);

    attribute.setName("bar");
    expect(attribute.name).toBe("bar");

    attribute.setUnits("m");
    expect(attribute.units).toBe("m");

    attribute.addValue(1);
    expect(attribute.length).toBe(1);
    expect(attribute.value(0)).toBe(1);

    attribute.addValues([2, 3]);
    expect(attribute.length).toBe(3);
    expect(attribute.value(1)).toBe(2);
    expect(attribute.value(2)).toBe(3);

    attribute.addValue(0, 0);
    expect(attribute.length).toBe(4);
    expect(attribute.value(0)).toBe(0);
    expect(attribute.value(3)).toBe(3);

    attribute.addValues([-2, -1], 0);
    expect(attribute.length).toBe(6);
    expect(attribute.value(0)).toBe(-2);
    expect(attribute.value(5)).toBe(3);

    attribute.setValue(2, 3);
    expect(attribute.value(2)).toBe(3);
    attribute.setValue(10, 10);

    attribute.setValues([0, 1], [1, 2]);
    expect(attribute.value(0)).toBe(1);
    expect(attribute.value(1)).toBe(2);
    attribute.setValues([10, 11], [10, 11]);

    attribute.setValues([0, 1], [0]);
    expect(attribute.value(0)).toBe(0);
    expect(attribute.value(1)).toBe(2);

    attribute.removeValues(2);
    expect(attribute.length).toBe(5);
    expect(attribute.value(2)).toBe(1);

    attribute.removeValues(0, 2);
    expect(attribute.length).toBe(3);
    expect(attribute.value(0)).toBe(1);
    attribute.removeValues(0, 0);
    expect(attribute.length).toBe(3);
    expect(attribute.value(0)).toBe(1);
  });
  test("derive", () => {
    const bar = Attribute.create({ name: "bar", values: [0, 1, 2] } as any);
    expect(bar.name).toBe("bar");
    expect(bar.length).toBe(3);

    const bazSnap = bar.derive("baz");
    expect(bazSnap.id).toBe(bar.id);
    expect(bazSnap.name).toBe("baz");
    expect(bazSnap.values && bazSnap.values.length).toBe(0);

    const barSnap = bar.derive();
    expect(barSnap.id).toBe(bar.id);
    expect(barSnap.name).toBe(bar.name);
    expect(barSnap.values && barSnap.values.length).toBe(0);
  });

  const valuesToTest: IAttributeSnapshot['values'][] = [
    [0, 1, 2],
    ["0", "1", "2"],
    [1, "2", "3"],
    ["a", "b", "c"],
    ["a", "1", "2"],
    ["", "1", "2"],
    [undefined, "1", "2"],
    ["", "a", "b"],
    [undefined, "a", "b"],
    ["1", "a", "a"],
    ["", "1", "a"],
    ["", "", "", "1", "a"],
    ["2/23", "2/24"],
    ["2/23", "1", "2"],
    ["ccimg://fbrtdb.concord.org/devclass/-NcP-LmubeWUdANUM_vO", "1"],
    ["ccimg://fbrtdb.concord.org/devclass/-NcP-LmubeWUdANUM_vO", "1", "a"]
  ];

  test("type", () => {
    const testCases = valuesToTest.map(values => {
      return [values, Attribute.create({name: "foo", values}).type];
    });
    expect({ testCases }).toMatchInlineSnapshot(`
[0,1,2] => "numeric"
["0","1","2"] => "numeric"
[1,"2","3"] => "numeric"
["a","b","c"] => "categorical"
["a","1","2"] => "categorical"
["","1","2"] => "numeric"
[null,"1","2"] => "numeric"
["","a","b"] => "categorical"
[null,"a","b"] => "categorical"
["1","a","a"] => "categorical"
["","1","a"] => "categorical"
["","","","1","a"] => "categorical"
["2/23","2/24"] => "categorical"
["2/23","1","2"] => "categorical"
["ccimg://fbrtdb.concord.org/devclass/-NcP-LmubeWUdANUM_vO","1"] => "categorical"
["ccimg://fbrtdb.concord.org/devclass/-NcP-LmubeWUdANUM_vO","1","a"] => "categorical"
`);
  });

  test("typeCounts", () => {
    const testCases = valuesToTest.map(values => {
      return [values, Attribute.create({name: "foo", values}).typeCounts];
    });
    // This can be updated with `npm run test -- -u attribute.test`
    expect({ testCases }).toMatchInlineSnapshot(`
[0,1,2] => [["numeric",3]]
["0","1","2"] => [["numeric",3]]
[1,"2","3"] => [["numeric",3]]
["a","b","c"] => []
["a","1","2"] => [["numeric",2]]
["","1","2"] => [["numeric",2]]
[null,"1","2"] => [["numeric",2]]
["","a","b"] => []
[null,"a","b"] => []
["1","a","a"] => [["numeric",1]]
["","1","a"] => [["numeric",1]]
["","","","1","a"] => [["numeric",1]]
["2/23","2/24"] => [["date",2]]
["2/23","1","2"] => [["numeric",2],["date",1]]
["ccimg://fbrtdb.concord.org/devclass/-NcP-LmubeWUdANUM_vO","1"] => [["image",1],["numeric",1]]
["ccimg://fbrtdb.concord.org/devclass/-NcP-LmubeWUdANUM_vO","1","a"] => [["image",1],["numeric",1]]
`);
  });

  test("mostCommonType", () => {
    const testCases = valuesToTest.map(values => {
      return [values, Attribute.create({name: "foo", values}).mostCommonType];
    });
    // This can be updated with `npm run test -- -u attribute.test`
    expect({ testCases }).toMatchInlineSnapshot(`
[0,1,2] => "numeric"
["0","1","2"] => "numeric"
[1,"2","3"] => "numeric"
["a","b","c"] => "categorical"
["a","1","2"] => "numeric"
["","1","2"] => "numeric"
[null,"1","2"] => "numeric"
["","a","b"] => "categorical"
[null,"a","b"] => "categorical"
["1","a","a"] => "categorical"
["","1","a"] => "numeric"
["","","","1","a"] => "numeric"
["2/23","2/24"] => "date"
["2/23","1","2"] => "numeric"
["ccimg://fbrtdb.concord.org/devclass/-NcP-LmubeWUdANUM_vO","1"] => "image"
["ccimg://fbrtdb.concord.org/devclass/-NcP-LmubeWUdANUM_vO","1","a"] => "categorical"
`);
  });
});


