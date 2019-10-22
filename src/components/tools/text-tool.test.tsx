import * as Adapter from "enzyme-adapter-react-16";
import * as React from "react";
import { configure, mount } from "enzyme";
import TextToolComponent from "./text-tool";
import { DocumentModel, ProblemDocument, DocumentModelType } from "../../models/document/document";
import { createSingleTileContent } from "../../utilities/test-utils";
import { createStores } from "../../models/stores/stores";
import { DocumentsModelType, DocumentsModel } from "../../models/stores/documents";
import { CanvasComponent } from "../document/canvas";

configure({ adapter: new Adapter() });

describe("Markdown Text Tool Component", () => {
  let documents: DocumentsModelType;
  let document: DocumentModelType;

  beforeEach(() => {
    (window as any).getSelection = () => {
      return {
      };
    };
    document = DocumentModel.create({
      type: ProblemDocument,
      title: "test",
      uid: "1",
      key: "test",
      createdAt: 1,
      visibility: "public",
      content: createSingleTileContent({
        type: "Text",
        format: "markdown",
        text: ["**bold**", "_italics_", "__underline__", "superscripts_ 2<sup>4</sup>", "_subscripts H<sub>2</sub>O", "~~deleted~~", "```code```",
               "# heading1", "## heading2", "### heading3", "#### heading4", "##### heading5", "###### heading6",
               "* bulleted-list", "1. ordered-list", "---"]
      })
    });
    documents = DocumentsModel.create({});
    documents.add(document);
  });

  it("can return bold", () => {
    const stores = createStores({ documents });
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find("strong").exists()).toBe(true);
  });

  it("can return italics", () => {
    const stores = createStores({ documents });
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find("em").exists()).toBe(true);
  });

  it("can return underline", () => {
    const stores = createStores({ documents });
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find("u").exists()).toBe(true);
  });
  // Superscripts are not yet implemented in Markdown
  it.skip("can return superscripts", () => {
    const stores = createStores({ documents });
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find("sup").exists()).toBe(true);
  });
  // Subscripts are not yet implemented in Markdown
  it.skip("can return subscripts", () => {
    const stores = createStores({ documents });
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find("sub").exists()).toBe(true);
  });

  it("can return deleted", () => {
    const stores = createStores({ documents });
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find("del").exists()).toBe(true);
  });

  it("can return code", () => {
    const stores = createStores({ documents });
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find("code").exists()).toBe(true);
  });

  it("can return heading1", () => {
    const stores = createStores({ documents });
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find("h1").exists()).toBe(true);
  });

  it("can return heading2", () => {
    const stores = createStores({ documents });
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find("h2").exists()).toBe(true);
  });

  it("can return heading3", () => {
    const stores = createStores({ documents });
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find("h3").exists()).toBe(true);
  });

  it("can return heading4", () => {
    const stores = createStores({ documents });
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find("h4").exists()).toBe(true);
  });

  it("can return heading5", () => {
    const stores = createStores({ documents });
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find("h5").exists()).toBe(true);
  });

  it("can return heading6", () => {
    const stores = createStores({ documents });
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find("h6").exists()).toBe(true);
  });

  it("can return bulleted-list", () => {
    const stores = createStores({ documents });
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find("ul").exists()).toBe(true);
    expect(wrapper.find("li").exists()).toBe(true);
  });

  it("can return ordered-list", () => {
    const stores = createStores({ documents });
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find("ol").exists()).toBe(true);
    expect(wrapper.find("li").exists()).toBe(true);
  });

  it("can return horizontal rule", () => {
    const stores = createStores({ documents });
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find("hr").exists()).toBe(true);
  });

});
