import { SharedVariables } from "./shared-variables";
import { kVolatileVariableLabel } from "./variable-labels";

describe("SharedVariables.exportStableSnapshot", () => {
  const sharedVariables = SharedVariables.create({
    variables: [
      // Producer-marked volatile: value is produced at runtime and must be dropped from the export.
      { id: "volatileSensor", name: "temperature", value: 27.5,
        labels: ["input", "sensor:temperature", kVolatileVariableLabel] },
      { id: "volatileOutput", name: "fan", value: 3,
        labels: ["output", "live-output:Fan", kVolatileVariableLabel] },
      // Carries a sensor: label but is NOT marked volatile: its value is authored and must be kept.
      // (Guards the false-positive direction — stripping must key off the marker, not a display label.)
      { id: "authoredSensorLabeled", name: "threshold", value: 42, labels: ["sensor:temperature"] },
      // User-driven input and a plain authored variable: values preserved.
      { id: "userIn", name: "position", value: 5, labels: ["input", "position"] },
      { id: "plain", name: "x", value: 10, labels: [] },
    ]
  });

  const exportedById = () => {
    const exported = sharedVariables.exportStableSnapshot() as { variables: Array<Record<string, any>> };
    return Object.fromEntries(exported.variables.map(v => [v.id, v]));
  };

  it("drops value only from variables marked volatile", () => {
    const byId = exportedById();
    expect(byId.volatileSensor).not.toHaveProperty("value");
    expect(byId.volatileOutput).not.toHaveProperty("value");
    expect(byId.userIn.value).toBe(5);
    expect(byId.plain.value).toBe(10);
  });

  it("preserves the value of an unmarked variable even when it carries a sensor: label", () => {
    // A running simulation is not driving this variable, so its authored value must survive export.
    const byId = exportedById();
    expect(byId.authoredSensorLabeled.value).toBe(42);
  });

  it("preserves non-value fields (including the volatile marker) of stripped variables", () => {
    const byId = exportedById();
    expect(byId.volatileSensor.name).toBe("temperature");
    expect(byId.volatileSensor.labels).toEqual(["input", "sensor:temperature", kVolatileVariableLabel]);
  });
});
