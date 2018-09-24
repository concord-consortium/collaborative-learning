import * as Adapter from "enzyme-adapter-react-16";
import * as React from "react";

import { configure, mount } from "enzyme";

import { FourUpComponent } from "./four-up";
import { GroupsModel, GroupModel, GroupUserModel } from "../models/groups";
import { SectionWorkspaceModel, WorkspacesModelType, SectionWorkspaceModelType,
  WorkspacesModel } from "../models/workspaces";
import { DocumentModel } from "../models/document";
import { createStores } from "../models/stores";
import { CanvasComponent } from "./canvas";
import { UserModel } from "../models/user";
import { componentByNodeRegistery } from "mobx-react";

configure({ adapter: new Adapter() });

describe("Four Up Component", () => {
  let workspaces: WorkspacesModelType;
  let workspace: SectionWorkspaceModelType;

  beforeEach(() => {
    workspace = SectionWorkspaceModel.create({
      mode: "1-up",
      tool: "select",
      sectionId: "1",
      visibility: "public",
      document: DocumentModel.create({
        uid: "1",
        key: "test",
        createdAt: 1,
        content: {}
      }),
      groupDocuments: {},
    });
    workspaces = WorkspacesModel.create({});
    workspaces.addSectionWorkspace(workspace);
  });

  it("can render", () => {
    const stores = createStores();
    const comp = mount(<FourUpComponent workspace={workspace} stores={stores}/>);
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
      workspaces
    });

    const comp = mount(<FourUpComponent workspace={workspace} stores={stores}/>);
    expect(comp.find(CanvasComponent)).toHaveLength(4);
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
