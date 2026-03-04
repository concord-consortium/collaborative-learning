import { defaultWaveRunnerContent, WaveRunnerContentModel } from "./wave-runner-content";

describe("WaveRunnerContent", () => {
  it("has default content of 'Wave Runner Content'", () => {
    const content = defaultWaveRunnerContent();
    expect(content.text).toBe("Wave Runner Content");
  });

  it("supports changing the text", () => {
    const content = WaveRunnerContentModel.create();
    content.setText("New Text");
    expect(content.text).toBe("New Text");
  });

  it("is always user resizable", () => {
    const content = WaveRunnerContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});