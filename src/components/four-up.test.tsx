import { configure, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { FourUpComponent } from "./four-up";
import { GroupsModel, GroupModel, GroupUserModel } from "../models/stores/groups";
import { DocumentModel, DocumentModelType } from "../models/document/document";
import { ProblemDocument } from "../models/document/document-types";
import { DocumentsModelType, DocumentsModel } from "../models/stores/documents";
import { specStores } from "../models/stores/spec-stores";
import { UserModel } from "../models/stores/user";

configure({testIdAttribute: "data-test"});

var mockGetQueryState = jest.fn();
jest.mock("react-query", () => ({
  useQueryClient: () => ({
    getQueryState: mockGetQueryState
  })
}));

describe("Four Up Component", () => {
  let documents: DocumentsModelType;
  let document: DocumentModelType;

  beforeEach(() => {
    document = DocumentModel.create({
      type: ProblemDocument,
      title: "test",
      uid: "1",
      groupId: "1",
      key: "test",
      createdAt: 1,
      content: {}
    });
    documents = DocumentsModel.create({});
    documents.add(document);
  });

  it("can render", () => {
    const group = GroupModel.create({
      id: "1",
      users: [
        GroupUserModel.create({
          id: "1",
          name: "User 1",
          initials: "U1",
          connectedTimestamp: 1
        })
      ]
    });
    const groups = GroupsModel.create({
      allGroups: [group]
    });

    const stores = specStores({ groups, documents });
    const { container } = render(<FourUpComponent userId={document.uid} groupId={document.groupId} stores={stores}/>);
    expect(screen.queryAllByTestId("canvas")).toHaveLength(4);
    expect(container.querySelectorAll(".member")).toHaveLength(1);
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

    const stores = specStores({ user, groups, documents });

    const { container } = render(<FourUpComponent userId={user.id} groupId={group.id} stores={stores}/>);
    // A canvas will be rendered unless an "unshared document" message is displayed.
    // User 2 has no document, so it will display an "unshared document" message.
    // User 1 has a shared document, User 3 is the main user, and there is no fourth user. All of those show canvases.
    expect(screen.queryAllByTestId("canvas")).toHaveLength(3);
    // Users 1, 2 and 3 should be labelled
    const memberList = container.querySelectorAll(".member");
    expect(memberList).toHaveLength(3);
    // First member is the current user, followed by group members
    expect(memberList[0].textContent).toBe("U3");
    expect(memberList[1].textContent).toBe("U1");
    expect(memberList[2].textContent).toBe("U2");

    // TODO: figure out how to add coverage for window mouse events setup by the splitter handlers
    userEvent.click(screen.getByTestId("4up-horizontal-splitter"));
    userEvent.click(screen.getByTestId("4up-vertical-splitter"));
    userEvent.click(screen.getByTestId("4up-center"));
  });
});
