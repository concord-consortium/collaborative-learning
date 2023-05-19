import { defaultSimulatorContent, SimulatorContentModel } from "./simulator-content";

describe("SimulatorContent", () => {
  it("has default content of 'hello world'", () => {
    const content = defaultSimulatorContent();
    expect(content.text).toBe("Hello World");
  });

  it("supports changing the text", () => {
    const content = SimulatorContentModel.create();
    content.setText("New Text");
    expect(content.text).toBe("New Text");
  });

  it("is always user resizable", () => {
    const content = SimulatorContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
