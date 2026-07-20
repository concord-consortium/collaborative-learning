import { SharedVariables } from "./shared-variables";

describe("SharedVariables.exportJson", () => {
  const sharedVariables = SharedVariables.create({
    variables: [
      // sensor input and live output: value is produced/overwritten by a running simulation
      { id: "sensorIn", name: "temperature", value: 27.5, labels: ["input", "sensor:temperature"] },
      { id: "liveOut", name: "fan", value: 3, labels: ["output", "live-output:Fan"] },
      // user-driven input (e.g. a potentiometer position): "input" label but no "sensor:" label
      { id: "userIn", name: "position", value: 5, labels: ["input", "position"] },
      // plain authored variable
      { id: "plain", name: "x", value: 10, labels: [] },
    ]
  });

  const exportedById = () => {
    const exported = sharedVariables.exportJson() as { variables: Array<Record<string, any>> };
    return Object.fromEntries(exported.variables.map(v => [v.id, v]));
  };

  it("drops value only from simulation-driven (sensor/live-output) variables", () => {
    const byId = exportedById();
    expect(byId.sensorIn).not.toHaveProperty("value");
    expect(byId.liveOut).not.toHaveProperty("value");
    expect(byId.userIn.value).toBe(5);
    expect(byId.plain.value).toBe(10);
  });

  it("preserves non-value fields of stripped variables", () => {
    const byId = exportedById();
    expect(byId.sensorIn.name).toBe("temperature");
    expect(byId.sensorIn.labels).toEqual(["input", "sensor:temperature"]);
  });
});
