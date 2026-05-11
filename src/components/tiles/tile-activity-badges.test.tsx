import { render, screen } from "@testing-library/react";
import { Provider } from "mobx-react";
import React from "react";
import { ClassModel } from "../../models/stores/class";
import { createDocumentModel } from "../../models/document/document";
import { DocumentType, GroupDocument, ProblemDocument } from "../../models/document/document-types";
import { DocumentsModel } from "../../models/stores/documents";
import { GroupActivityModel } from "../../models/stores/group-activity";
import { GroupModel, GroupsModel, GroupUserModel } from "../../models/stores/groups";
import { specStores } from "../../models/stores/spec-stores";
import { UserModel } from "../../models/stores/user";
import { TileActivityBadges } from "./tile-activity-badges";

const kDocKey = "doc-1";
const kTileId = "tile-1";

// react-tippy renders the `html`/`title` content into a portal that only mounts
// when the tooltip is shown — invisible to RTL queries. Replace it with a
// passthrough that renders the tooltip content alongside the trigger so tests
// can assert on it.
jest.mock("react-tippy", () => ({
  Tooltip: ({ html, title, children }: any) => (
    <>
      {children}
      {(html ?? title) != null && <div data-testid="tippy-content">{html ?? title}</div>}
    </>
  )
}));

interface IBuildStoresOptions {
  documentType?: DocumentType;
  numFocused?: number;
  includeLocalUserFocus?: boolean;
}

const kLocalUserId = "local";

function buildStores({
  documentType = GroupDocument,
  numFocused = 0,
  includeLocalUserFocus = false
}: IBuildStoresOptions = {}) {
  const otherUserIds = ["1", "2", "3", "4", "5", "6"];
  const allUserIds = [kLocalUserId, ...otherUserIds];
  const classUsers: Record<string, any> = {};
  allUserIds.forEach((id, idx) => {
    classUsers[id] = {
      type: "student",
      id,
      firstName: "First",
      lastName: `Last${idx + 1}`,
      fullName: `First Last${idx + 1}`,
      initials: `F${idx + 1}`
    };
  });
  const clazz = ClassModel.create({
    name: "Test Class",
    classHash: "test",
    timestamp: 1,
    users: classUsers
  });

  const group = GroupModel.create({
    id: "g1",
    users: allUserIds.map(id => GroupUserModel.create({ id, connectedTimestamp: 2 }))
  });
  const groups = GroupsModel.create({ groupsMap: { g1: group } });

  const documents = DocumentsModel.create({});
  const document = createDocumentModel({
    type: documentType,
    uid: "1",
    key: kDocKey,
    createdAt: 1,
    content: {}
  });
  documents.add(document);

  const groupActivity = GroupActivityModel.create({});
  // numFocused refers to OTHER users focused on the tile; the local user
  // is added separately when includeLocalUserFocus is set.
  for (let i = 0; i < numFocused; i++) {
    groupActivity.setActivity({
      userId: otherUserIds[i],
      documentKey: kDocKey,
      focus: { tileIds: [kTileId] },
      updatedAt: 100 + i
    });
  }
  if (includeLocalUserFocus) {
    groupActivity.setActivity({
      userId: kLocalUserId,
      documentKey: kDocKey,
      focus: { tileIds: [kTileId] },
      updatedAt: 99
    });
  }

  // The local user must be a member of the group so the component can
  // resolve names/initials through groups.groupForUser(user.id).
  const user = UserModel.create({ id: kLocalUserId });
  return specStores({ user, class: clazz, groups, documents, groupActivity });
}

describe("TileActivityBadges", () => {
  it("renders nothing when no users are focused", () => {
    const stores = buildStores({ numFocused: 0 });
    const { container } = render(
      <Provider stores={stores}>
        <TileActivityBadges documentKey={kDocKey} tileId={kTileId} hovered={false} selected={false} />
      </Provider>
    );
    expect(container.querySelector(".tile-activity-badges")).toBeNull();
  });

  it("renders nothing when document type is not 'group'", () => {
    const stores = buildStores({ documentType: ProblemDocument, numFocused: 2 });
    const { container } = render(
      <Provider stores={stores}>
        <TileActivityBadges documentKey={kDocKey} tileId={kTileId} hovered={false} selected={false} />
      </Provider>
    );
    expect(container.querySelector(".tile-activity-badges")).toBeNull();
  });

  it.each([1, 2, 3, 4])("renders %i badges", (n) => {
    const stores = buildStores({ numFocused: n });
    render(
      <Provider stores={stores}>
        <TileActivityBadges documentKey={kDocKey} tileId={kTileId} hovered={false} selected={false} />
      </Provider>
    );
    expect(screen.getAllByTestId("activity-badge")).toHaveLength(n);
    expect(screen.queryByTestId("activity-badge-overflow")).toBeNull();
  });

  it("renders 4 + '+N' overflow when 5+ users", () => {
    const stores = buildStores({ numFocused: 6 });
    render(
      <Provider stores={stores}>
        <TileActivityBadges documentKey={kDocKey} tileId={kTileId} hovered={false} selected={false} />
      </Provider>
    );
    expect(screen.getAllByTestId("activity-badge")).toHaveLength(4);
    const overflow = screen.getByTestId("activity-badge-overflow");
    expect(overflow.textContent).toBe("+2");
  });

  it("filters out the local user's own focus", () => {
    // Only the local user is focused on the tile — nothing should render.
    const stores = buildStores({ numFocused: 0, includeLocalUserFocus: true });
    const { container } = render(
      <Provider stores={stores}>
        <TileActivityBadges documentKey={kDocKey} tileId={kTileId} hovered={false} selected={false} />
      </Provider>
    );
    expect(container.querySelector(".tile-activity-badges")).toBeNull();
  });

  it("renders only other users when local user is also focused", () => {
    // 2 other users + local user — render 2 badges, not 3.
    const stores = buildStores({ numFocused: 2, includeLocalUserFocus: true });
    render(
      <Provider stores={stores}>
        <TileActivityBadges documentKey={kDocKey} tileId={kTileId} hovered={false} selected={false} />
      </Provider>
    );
    expect(screen.getAllByTestId("activity-badge")).toHaveLength(2);
  });

  it("tooltip lists all focused users' full names", () => {
    const stores = buildStores({ numFocused: 3 });
    const { container } = render(
      <Provider stores={stores}>
        <TileActivityBadges documentKey={kDocKey} tileId={kTileId} hovered={false} selected={false} />
      </Provider>
    );

    // Other users start at allUserIds index 1, so lastNames are Last2..Last7;
    // numFocused=3 expects Last2..Last4.
    const names = Array.from(container.querySelectorAll(".badge-tooltip > div"))
      .map(d => d.textContent);
    expect(names).toEqual(["First Last2", "First Last3", "First Last4"]);
  });

  it("applies left-shift class when hovered or selected", () => {
    const stores = buildStores({ numFocused: 1 });

    const { rerender } = render(
      <Provider stores={stores}>
        <TileActivityBadges documentKey={kDocKey} tileId={kTileId} hovered={false} selected={false} />
      </Provider>
    );
    expect(screen.getByTestId("tile-activity-badges")).not.toHaveClass("drag-handle-visible");

    rerender(
      <Provider stores={stores}>
        <TileActivityBadges documentKey={kDocKey} tileId={kTileId} hovered={true} selected={false} />
      </Provider>
    );
    expect(screen.getByTestId("tile-activity-badges")).toHaveClass("drag-handle-visible");

    rerender(
      <Provider stores={stores}>
        <TileActivityBadges documentKey={kDocKey} tileId={kTileId} hovered={false} selected={true} />
      </Provider>
    );
    expect(screen.getByTestId("tile-activity-badges")).toHaveClass("drag-handle-visible");
  });
});
