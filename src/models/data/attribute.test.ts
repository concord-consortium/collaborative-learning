import { Attribute, IAttributeCreation } from "./attribute";
import { clone } from "lodash";

test("Attribute functionality", () => {
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

  const bar = Attribute.create({ name: "bar", values: [0, 1, 2] } as any);
  expect(bar.name).toBe("bar");
  expect(bar.length).toBe(3);

  const bazSnap: IAttributeCreation = bar.derive("baz");
  expect(bazSnap.id).toBe(bar.id);
  expect(bazSnap.name).toBe("baz");
  expect(bazSnap.values && bazSnap.values.length).toBe(0);

  const barSnap: IAttributeCreation = bar.derive();
  expect(barSnap.id).toBe(bar.id);
  expect(barSnap.name).toBe(bar.name);
  expect(barSnap.values && barSnap.values.length).toBe(0);
});
