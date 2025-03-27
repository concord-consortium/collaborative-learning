import { configure, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "mobx-react";
import { FourUpComponent } from "./four-up";
import { GroupsModel, GroupModel, GroupUserModel } from "../models/stores/groups";
import { createDocumentModel, DocumentModelType } from "../models/document/document";
import { ProblemDocument } from "../models/document/document-types";
import { DocumentsModelType, DocumentsModel } from "../models/stores/documents";
import { specStores } from "../models/stores/spec-stores";
import { UserModel } from "../models/stores/user";
import { ClassModel } from "../models/stores/class";
import { PersistentUIModel } from "../models/stores/persistent-ui/persistent-ui";
import { ProblemWorkspace, WorkspaceModel } from "../models/stores/workspace";
import { AppConfigModel } from "../models/stores/app-config-model";
import { unitConfigDefaults } from "../test-fixtures/sample-unit-configurations";

configure({testIdAttribute: "data-test"});

const mockGetQueryState = jest.fn();
jest.mock("react-query", () => ({
  useQueryClient: () => ({
    getQueryState: mockGetQueryState
  })
}));
jest.mock("../hooks/use-stores", () => ({
  useStores: () => ({
    ui: {
      setDraggingId: (id?: string) => undefined
    },
    persistentUI: {
      problemWorkspace: {
        primaryDocumentKey: "1"
      }
    },
  }),
  // TODO: Audit similar tests for instantiations of properties that are not required
  useUIStore: () => ({}),
  usePersistentUIStore: () => ({})
}));

describe("Four Up Component", () => {
  let documents: DocumentsModelType;
  let document: DocumentModelType;

  beforeEach(() => {
    document = createDocumentModel({
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
          connectedTimestamp: 1
        })
      ]
    });
    const groups = GroupsModel.create({
      groupsMap: {1: group}
    });
    const persistentUI = PersistentUIModel.create({
      problemWorkspace: WorkspaceModel.create({ type: ProblemWorkspace, mode: "4-up" })
    });
    const appConfig = AppConfigModel.create({ config: unitConfigDefaults });

    const stores = specStores({ groups, documents, persistentUI, appConfig });

    const { container } = render(<Provider stores={stores}><FourUpComponent group={group} stores={stores}/></Provider>);
    expect(screen.queryAllByTestId("canvas")).toHaveLength(4);
    expect(container.querySelectorAll(".member")).toHaveLength(1);
  });

  it("renders group members", () => {
    const user = UserModel.create({
      id: "3",
      name: "User 3"
    });

    const clazz = ClassModel.create({
      name: "Test Class",
      classHash: "test",
      timestamp: 4000,
      users: {
        1: {
          type: "student",
          id: "1",
          firstName: "User",
          lastName: "1",
          fullName: "User 1",
          initials: "U1"
        },
        3: {
          type: "student",
          id: "3",
          firstName: "User",
          lastName: "3",
          fullName: "User 3",
          initials: "U3"
        }
      }
    });

    // TODO: add a test of how removed users are not shown
    const group = GroupModel.create({
      id: "1",
      users: [
        GroupUserModel.create({
          id: "1",
          connectedTimestamp: 1,
        }),
        // This user doesn't exist in the class and they their connectedTimestamp is
        // after the timestamp of the class. The code treats this student as being
        // added from the class. So it should be shown with the initials "**". At
        // runtime this will trigger a refresh of the class so the "**" should
        // quickly be replaced with the real initials.
        GroupUserModel.create({
          id: "2",
          connectedTimestamp: 10000,
          disconnectedTimestamp: 10001,
        }),
        GroupUserModel.create({
          id: "3",
          connectedTimestamp: 3,
          disconnectedTimestamp: 2,
        }),
        // This user doesn't exist in the class and they their connectedTimestamp is
        // before the timestamp of the class. The code treats this student as being
        // removed from the class. So it shouldn't be shown.
        GroupUserModel.create({
          id: "4",
          connectedTimestamp: 4,
          disconnectedTimestamp: 3,
        }),
      ],
    });
    const groups = GroupsModel.create({
      groupsMap: {1: group}
    },);
    const persistentUI = PersistentUIModel.create({
      problemWorkspace: WorkspaceModel.create({ type: ProblemWorkspace, mode: "4-up" })
    });

    const stores = specStores({ user, groups, documents, class: clazz, persistentUI });
    // When the store is created the groups store is cloned so it can have the correct
    // environment. Therefore we need to get the new groups store after specStores
    const realGroup = stores.groups.allGroups[0];

    const { container } = render(
      <Provider stores={stores}><FourUpComponent group={realGroup} stores={stores}/></Provider>
    );
    // A canvas will be rendered unless an "unshared document" message is displayed.
    // User 2 has no document, so it will display an "unshared document" message.
    // User 1 has a shared document, User 3 is the main user, and there is no active fourth user.
    // All of those show canvases.
    expect(screen.queryAllByTestId("canvas")).toHaveLength(3);
    // Users 1, 2 and 3 should be labelled
    const memberList = container.querySelectorAll(".member");
    expect(memberList).toHaveLength(3);
    // First member is the current user, followed by group members
    expect(memberList[0].textContent).toBe("U3");
    expect(memberList[1].textContent).toBe("U1");
    expect(memberList[2].textContent).toBe("**");

    // TODO: figure out how to add coverage for window mouse events setup by the splitter handlers
    userEvent.click(screen.getByTestId("4up-horizontal-splitter"));
    userEvent.click(screen.getByTestId("4up-vertical-splitter"));
    userEvent.click(screen.getByTestId("4up-center"));
  });
});
