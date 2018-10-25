import * as Adapter from "enzyme-adapter-react-16";
import * as React from "react";

import { configure, mount } from "enzyme";

import { FourUpComponent } from "./four-up";
import { GroupsModel, GroupModel, GroupUserModel } from "../models/groups";
import { DocumentModel, SectionDocument, DocumentModelType } from "../models/document";
import { createStores } from "../models/stores";
import { CanvasComponent } from "./canvas";
import { UserModel } from "../models/user";
import { WorkspaceModel, WorkspaceModelType, SectionWorkspace } from "../models/workspace";
import { DocumentsModelType, DocumentsModel } from "../models/documents";

configure({ adapter: new Adapter() });

describe("Four Up Component", () => {
  let workspace: WorkspaceModelType;
  let documents: DocumentsModelType;
  let document: DocumentModelType;

  beforeEach(() => {
    workspace = WorkspaceModel.create({
      type: SectionWorkspace,
      mode: "1-up",
    });
    document = DocumentModel.create({
      type: SectionDocument,
      title: "test",
      uid: "1",
      groupId: "1",
      key: "test",
      sectionId: "introduction",
      createdAt: 1,
      content: {}
    }),
    documents = DocumentsModel.create({});
    documents.add(document);
  });

  it("can render", () => {
    const stores = createStores();
    const comp = mount(<FourUpComponent document={document} workspace={workspace} stores={stores}/>);
    expect(comp.find(CanvasComponent)).toHaveLength(4);
    expect(comp.find(".member")).toHaveLength(1);
  });

  it("renders group members", () => {
    const user = UserModel.create({
      id: "3",
      name: "User 3"
    });

    const group = GroupModel.create({
      id: "1",
      users: [
        GroupUserModel.create({
          id: "1",
          name: "User 1",
          initials: "U1",
          connectedTimestamp: 1,
        }),
        GroupUserModel.create({
          id: "2",
          name: "User 2",
          initials: "U2",
          connectedTimestamp: 1,
          disconnectedTimestamp: 2,
        }),
        GroupUserModel.create({
          id: "3",
          name: "User 3",
          initials: "U3",
          connectedTimestamp: 3,
          disconnectedTimestamp: 2,
        }),
      ],
    });
    const groups = GroupsModel.create({
      allGroups: [group]
    });

    const stores = createStores({
      user,
      groups,
      documents
    });

    const comp = mount(<FourUpComponent document={document} workspace={workspace} stores={stores}/>);
    // A canvas will be rendered unless an "unshared document" message is displayed.
    // User 2 has no document, so it will display an "unshared document" message.
    // User 1 has a shared document, User 3 is the main user, and there is no fourth user. All of those show canvases.
    expect(comp.find(CanvasComponent)).toHaveLength(3);
    // Users 1, 2 and 3 should be labelled
    expect(comp.find(".member")).toHaveLength(3);
    // First member is the current user, followed by group members
    expect(comp.find(".member").at(0).text()).toBe("U3");
    expect(comp.find(".member").at(1).text()).toBe("U1");
    expect(comp.find(".member").at(2).text()).toBe("U2");

    // TODO: figure out how to add coverage for window mouse events setup by the spliiter handlers
    comp.find(".horizontal").simulate("mouseDown");
    comp.find(".horizontal").simulate("mouseUp");

    comp.find(".vertical").simulate("mouseDown");
    comp.find(".vertical").simulate("mouseUp");

    comp.find(".center").simulate("mouseDown");
    comp.find(".center").simulate("mouseUp");
  });
});
