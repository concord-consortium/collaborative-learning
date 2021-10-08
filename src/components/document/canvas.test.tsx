import Adapter from "enzyme-adapter-react-16";
import React from "react";

import { configure, mount } from "enzyme";
import { Provider } from "mobx-react";
import { CanvasComponent } from "./canvas";
import { DocumentContentComponent } from "./document-content";
import { DocumentModel } from "../../models/document/document";
import { DocumentContentModel } from "../../models/document/document-content";
import { ProblemDocument } from "../../models/document/document-types";
import { createStores } from "../../models/stores/stores";
import { createSingleTileContent } from "../../utilities/test-utils";

// import { logComponent } from "../utilities/test-utils";

configure({ adapter: new Adapter() });

describe("Canvas Component", () => {

  beforeEach(() => {
    // mock getSelection for text tool
    (window as any).getSelection = () => {
      return {
      };
    };
  });

  it.skip("can render without a document or content", () => {
    const stores = createStores();
    const wrapper = mount(
      <Provider stores={stores}>
        <CanvasComponent context="test" />
      </Provider>);
    expect(wrapper.find(DocumentContentComponent).length).toEqual(0);
  });

  it("can render with a document", () => {
    const document = DocumentModel.create({
      type: ProblemDocument,
      title: "test",
      uid: "1",
      key: "test",
      createdAt: 1,
      visibility: "public",
      content: createSingleTileContent({
        type: "Text",
        text: "test"
      })
    });
    const stores = createStores();
    const wrapper = mount(
      <Provider stores={stores}>
        <CanvasComponent context="test" document={document} readOnly={true} />
      </Provider>);
    expect(wrapper.find(DocumentContentComponent).length).toEqual(1);
    expect(wrapper.find(".text-tool").exists()).toBe(true);
  });

  it("can render with content", () => {
    const content = DocumentContentModel.create(createSingleTileContent({
      type: "Text",
      text: "test"
    }));
    const stores = createStores();
    const wrapper = mount(
      <Provider stores={stores}>
        <CanvasComponent context="test" content={content} readOnly={true} />
      </Provider>);
    expect(wrapper.find(DocumentContentComponent).length).toEqual(1);
    expect(wrapper.find(".text-tool").exists()).toBe(true);
  });

});
