import { getAllTextPluginInfos, getTextPluginIds, getTextPluginInfo, 
  getTextPluginInstances, registerTextPluginInfo } from "./text-plugin-info";

const testTextPluginInstance = {from: "testTextPluginInfo"};
const testTextPluginInfo = {
  iconName: "test",
  Icon: () => null,
  toolTip: "",
  createSlatePlugin: jest.fn(() => testTextPluginInstance),
  command: ""
};
const testTextPluginWithUpdateInstance = {from: "testTextPluginInfoWithUpdate"};
const testTextPluginInfoWithUpdate = {
  iconName: "testWithUpdate",
  Icon: () => null,
  toolTip: "",
  createSlatePlugin: jest.fn(() => testTextPluginWithUpdateInstance),
  command: "",
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
    const pluginInstances = getTextPluginInstances(textContent);
    expect(testTextPluginInfo.createSlatePlugin).toBeCalledWith(textContent);
    expect(testTextPluginInfoWithUpdate.createSlatePlugin).toBeCalledWith(textContent);
    expect(pluginInstances).toHaveLength(2);
    expect(pluginInstances).toContain(testTextPluginInstance);
    expect(pluginInstances).toContain(testTextPluginWithUpdateInstance);
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
