import { fixMqttMessage } from "./iot";

describe("fixMqttMessage() should fix bad MQTT messages", () => {

  const badPlug = (plug: number) => `"":{"version":, "plug":${plug}, "components": []}`;
  const co2Plug = (plug: number) => `"7FFF3B0B":{"version":1, "plug":${plug}, "components": [{"dir":"i","type":"CO2","model":"K-30","units":"PPM"}]}`;

  function isValidJson(str: string) {
    let result;
    try {
      result = JSON.parse(str);
    }
    catch (e) {
      // ignore
    }
    return !!result;
  }

  it("handles empty string", () => {
    expect(fixMqttMessage("")).toBe("");
    expect(fixMqttMessage("{}")).toBe("{}");
  });

  it("handles invalid plug alone", () => {
    const fixed = fixMqttMessage(`{${badPlug(1)}}`);
    expect(fixed).toBe("{}");
    expect(isValidJson(fixed)).toBe(true);
  });

  it("handles invalid plug at beginning", () => {
    const fixed = fixMqttMessage(`{${badPlug(1)},${co2Plug(2)}}`);
    expect(fixed).toBe(`{${co2Plug(2)}}`);
    expect(isValidJson(fixed)).toBe(true);
  });

  it("handles invalid plug at end", () => {
    const fixed = fixMqttMessage(`{${co2Plug(1)}},${badPlug(2)}`);
    expect(fixed).toBe(`{${co2Plug(1)}}`);
    expect(isValidJson(fixed)).toBe(true);
  });

  it("handles invalid plug in middle", () => {
    const fixed = fixMqttMessage(`{${co2Plug(1)},${badPlug(2)},${co2Plug(3)}}`);
    expect(fixed).toBe(`{${co2Plug(1)},${co2Plug(3)}}`);
    expect(isValidJson(fixed)).toBe(true);
  });

  it("handles multiple invalid plugs", () => {
    const fixed = fixMqttMessage(`{${badPlug(1)},${co2Plug(2)},${badPlug(3)},${co2Plug(4)},${badPlug(5)}}`);
    expect(fixed).toBe(`{${co2Plug(2)},${co2Plug(4)}}`);
    expect(isValidJson(fixed)).toBe(true);
  });
});
