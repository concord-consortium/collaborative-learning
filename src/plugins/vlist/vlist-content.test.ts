import { defaultVListContent, VListContentModel } from "./vlist-content";

describe("VListContent", () => {
  // FIXME: need to have a document and shared model to run these tests now.
  // 
  // it("has default content of 'hello world'", () => {
  //   const content = defaultVListContent();
  //   expect(content.variables[0]).toBe("Hello World");
  // });

  // it("supports adding a variable", () => {
  //   const content = VListContentModel.create();
  //   content.addVariable("New Variable");
  //   expect(content.variables[0]).toBe("New Variable");
  // });

  it("is always user resizable", () => {
    const content = VListContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
