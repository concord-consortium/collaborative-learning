import { WaveRunnerContentModel } from "./wave-runner-content";

describe.skip("WaveRunnerContent", () => {
  it("is always user resizable", () => {
    const content = WaveRunnerContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
