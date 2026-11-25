import { defaultFlowchartContent, FlowchartContentModel } from "./flowchart-content";

describe("FlowchartContent", () => {
  it("creates default content of the Flowchart type", () => {
    const content = defaultFlowchartContent();
    expect(content.type).toBe("Flowchart");
  });

  it("is always user resizable", () => {
    const content = FlowchartContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });

  it("exports a JSON string including the persisted fields", () => {
    const content = FlowchartContentModel.create();
    const json = content.exportJson();
    expect(JSON.parse(json)).toEqual({ type: "Flowchart" });
  });
});
