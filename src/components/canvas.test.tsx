import * as Adapter from "enzyme-adapter-react-16";
import * as React from "react";

import { configure, mount, shallow } from "enzyme";

import { CanvasComponent } from "./canvas";
import { DocumentContentModel } from "../models/document-content";
import { DocumentContentComponent } from "./document-content";
import { DocumentModel } from "../models/document";
import { createStores } from "../models/stores";

import { logComponent } from "../utilities/test-utils";

configure({ adapter: new Adapter() });

describe("Canvas Component", () => {

  beforeEach(() => {
    // mock getSelection for text tool
    (window as any).getSelection = () => {
      return {
      };
    };
  });

  it("can render without a document or content", () => {
    const wrapper = mount(<CanvasComponent context="test" />);
    expect(wrapper.find(DocumentContentComponent).length).toEqual(0);
  });

  it("can render with a document", () => {
    const document = DocumentModel.create({
      uid: "1",
      key: "test",
      createdAt: 1,
      content: DocumentContentModel.create({
        tiles: [{
          content: {
            type: "Text",
            text: "test"
          }
        }]
      }),
    });
    const stores = createStores();
    const wrapper = mount(<CanvasComponent context="test" document={document} stores={stores} readOnly={true} />);
    expect(wrapper.find(DocumentContentComponent).length).toEqual(1);
    expect(wrapper.find(".text-tool").exists()).toBe(true);
  });

  it("can render with content", () => {
    const content = DocumentContentModel.create({
      tiles: [{
        content: {
          type: "Text",
          text: "test"
        }
      }]
    });
    const stores = createStores();
    const wrapper = mount(<CanvasComponent context="test" content={content} stores={stores} readOnly={true} />);
    expect(wrapper.find(DocumentContentComponent).length).toEqual(1);
    expect(wrapper.find(".text-tool").exists()).toBe(true);
  });

});
