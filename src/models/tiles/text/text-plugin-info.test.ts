import { getAllTextPluginInfos, getTextPluginIds, getTextPluginInfo,
  createTextPluginInstances, registerTextPluginInfo } from "./text-plugin-info";

const testTextPluginInstance = {from: "testTextPluginInfo"} as any;
const testTextPluginInfo = {
  pluginName: "test",
  createSlatePlugin: jest.fn(() => testTextPluginInstance),
  buttonDefs: {}
};
const testTextPluginWithUpdateInstance = {from: "testTextPluginInfoWithUpdate"}  as any;
const testTextPluginInfoWithUpdate = {
  pluginName: "testWithUpdate",
  createSlatePlugin: jest.fn(() => testTextPluginWithUpdateInstance),
  buttonDefs: {},
  updateTextContentAfterSharedModelChanges: jest.fn()
};

registerTextPluginInfo(testTextPluginInfo);
registerTextPluginInfo(testTextPluginInfoWithUpdate);

describe("TextPluginInfo", () => {
  test("getTextPluginInfo", () => {
    expect(getTextPluginInfo("test")).toBe(testTextPluginInfo);
    expect(getTextPluginInfo("testWithUpdate")).toBe(testTextPluginInfoWithUpdate);
    expect(getTextPluginInfo("foo")).toBeUndefined();
  });

  test("getTextPluginInstances", () => {
    const textContent: any = {foo: "bar"};
    const pluginInstances = createTextPluginInstances(textContent);
    expect(testTextPluginInfo.createSlatePlugin).toHaveBeenCalledWith(textContent);
    expect(testTextPluginInfoWithUpdate.createSlatePlugin).toHaveBeenCalledWith(textContent);
    expect(Object.entries(pluginInstances)).toHaveLength(2);
    expect(pluginInstances.test).toBe(testTextPluginInstance);
    expect(pluginInstances.testWithUpdate).toBe(testTextPluginWithUpdateInstance);
  });

  test("getTextPluginIds", () => {
    const pluginIds = getTextPluginIds();
    expect(pluginIds).toHaveLength(2);
    expect(pluginIds).toContain("test");
    expect(pluginIds).toContain("testWithUpdate");
  });

  test("getTextPluginIds", () => {
    const pluginInfos = getAllTextPluginInfos();
    expect(pluginInfos).toHaveLength(2);
    expect(pluginInfos).toContain(testTextPluginInfo);
    expect(pluginInfos).toContain(testTextPluginInfoWithUpdate);
  });
});
