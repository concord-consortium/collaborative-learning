import { observable } from "mobx";
import { mock } from "ts-jest-mocker";
import { DeepPartial } from "utility-types";
import { SnapshotIn } from "mobx-state-tree";

import { createDocumentModel, DocumentModelSnapshotType, DocumentModelType } from "../document/document";
import { DocumentContentSnapshotType } from "../document/document-content";
import { ProblemDocument } from '../document/document-types';
import { ClassModel, ClassModelType, ClassUserModel } from "./class";
import { GroupModel, GroupsModel, GroupsModelType, GroupUserModel } from "./groups";
import { ISortedDocumentsStores, MetadataDocMapModel, SortedDocuments } from "./sorted-documents";
import { DB } from "../../lib/db";
import { Bookmark, Bookmarks } from "./bookmarks";

//****************************************** Documents Mock ***************************************

const mockDocumentsData: DocumentModelSnapshotType[] = [
  { uid: "1", //Joe
    type: ProblemDocument, key:"Student 1 Problem Doc Group 5", groupId: "5", createdAt: 1,
    content: { tiles: [] } as DocumentContentSnapshotType
  },
  { uid: "2", //Scott
    type: ProblemDocument, key:"Student 2 Problem Doc Group 3", groupId: "3", createdAt: 2,
    content: { tiles: [{ id: "textTool", content: {type: "Text" }}] } as DocumentContentSnapshotType
  },
  { uid: "3", //Dennis
    type: ProblemDocument, key:"Student 3 Problem Doc Group 9", groupId: "9", createdAt: 3,
    content: { tiles: [
      { id: "drawingTool", content: { type: "Drawing", objects: [] }}] } as DocumentContentSnapshotType
  },
  { uid: "4", //Kirk
    type: ProblemDocument, key:"Student 4 Problem Doc Group 3", groupId: "3", createdAt: 4,
    content: { tiles: [] } as DocumentContentSnapshotType
  }
];

const mockMetadataDocuments: SnapshotIn<typeof MetadataDocMapModel> = {
  "Student 1 Problem Doc Group 5": {
    uid: "1", //Joe
    type: ProblemDocument,
    key:"Student 1 Problem Doc Group 5",
    createdAt: 1,
    tools: [],
    strategies: ["foo", "bar"],
    investigation: "1",
    problem: "1"
  },
  "Student 2 Problem Doc Group 3": {
    uid: "2", //Scott
    type: ProblemDocument, key:"Student 2 Problem Doc Group 3", createdAt: 2,
    tools: ["Text"],
    investigation: "1",
    problem: "2"
  },
  "Student 3 Problem Doc Group 9": {
    uid: "3", //Dennis
    type: ProblemDocument, key:"Student 3 Problem Doc Group 9", createdAt: 3,
    tools: ["Drawing"],
    investigation: "2",
    problem: "1"
  },
  "Student 4 Problem Doc Group 3": {
    uid: "4", //Kirk
    type: ProblemDocument, key:"Student 4 Problem Doc Group 3", createdAt: 4,
    tools: [],
    strategies: ["bar"],
    investigation: "1",
    problem: "2"
  }
};

const createMockDocuments = () => {
  return mockDocumentsData.map(createDocumentModel);
};

//**************************************** Class/Users Mock ***************************************

const createMockClassUsers = () => {
  return {
    "1": ClassUserModel.create(
          { type: "student", id: "1", firstName: "Joe", lastName: "Bacal",
            fullName: "Joe Bacal", initials: "JB" }),
    "2": ClassUserModel.create(
          { type: "student", id: "2", firstName: "Scott", lastName: "Cytacki",
            fullName: "Scott Cytacki", initials: "SC" }),
    "3": ClassUserModel.create(
          { type: "student", id: "3", firstName: "Dennis", lastName: "Cao",
            fullName: "Dennis Cao", initials: "DC" }),
    "4": ClassUserModel.create(
      { type: "student", id: "4", firstName: "Kirk", lastName: "Swenson",
            fullName: "Kirk Swenson", initials: "KS" }),
  };
};
const createMockClassWithUsers = () => {
  const mockUsers = createMockClassUsers();
  const mockClass = ClassModel.create({
    name: "Mock Class",
    classHash: "mock",
    users: mockUsers
  });
  return mockClass;
};

//****************************************** Groups Mock ******************************************

type GroupUserData = {
  id: string;
  connectedTimestamp: number;
  disconnectedTimestamp?: number;
};

const createMockGroupUsers = (groupUsersData: GroupUserData[]) => {
  return groupUsersData.map(userData =>
    GroupUserModel.create({
      id: userData.id,
      connectedTimestamp: userData.connectedTimestamp,
      disconnectedTimestamp: userData.disconnectedTimestamp
    })
  );
};

const createMockGroups = () => {
  const group3UsersData = [
    { id: "2", connectedTimestamp: 2 },
    { id: "4", connectedTimestamp: 4 },
  ];
  const group5UsersData = [
    { id: "1", connectedTimestamp: 1 },
  ];
  const group9UsersData = [
    { id: "3", connectedTimestamp: 3 },
  ];

  const group3Users = createMockGroupUsers(group3UsersData);
  const group5Users = createMockGroupUsers(group5UsersData);
  const group9Users = createMockGroupUsers(group9UsersData);

  const mockGroups = GroupsModel.create({
    groupsMap: {
      3: GroupModel.create({ id: "3", users: group3Users }),
      5: GroupModel.create({ id: "5", users: group5Users }),
      9: GroupModel.create({ id: "9", users: group9Users }),
    }
  });
  return mockGroups;
};

// ***** Bookmarks Mock ***** //

function addDocBookmarks(bookmarks: Bookmarks, bookmarkMap: Record<string, Array<Bookmark>>) {
  Object.entries(bookmarkMap).forEach(([docKey, array]) => {
    bookmarks.bookmarkMap.set(docKey, observable.array(array));
  });
}

//****************************************** Jest Tests *******************************************


describe('DocumentGroup Model', () => {
  let sortedDocuments: SortedDocuments;
  let mockDocuments: DocumentModelType[];
  let mockGroups: GroupsModelType;
  let mockClass: ClassModelType;
  let bookmarks: Bookmarks;

  beforeEach(() => {
    mockDocuments = createMockDocuments();
    mockGroups = createMockGroups();
    mockClass = createMockClassWithUsers();
    const db = mock(DB);
    Object.setPrototypeOf(db, DB);
    bookmarks = new Bookmarks({db});

    const mockStores: DeepPartial<ISortedDocumentsStores> = {
      //DeepPartial allows us to not need to mock the "dB" and "appConfig" stores
      //as well not needing to type the stores below
      documents: { all: mockDocuments, exemplarDocuments: [] },
      groups: mockGroups,
      class: mockClass,
      appConfig: {
        commentTags: {"foo": "foo", "bar": "bar"},
        termOverrides: undefined,
        tagPrompt: undefined
      },
      bookmarks
    };

    sortedDocuments = new SortedDocuments(mockStores as ISortedDocumentsStores);
    sortedDocuments.metadataDocsFiltered = MetadataDocMapModel.create(mockMetadataDocuments);
  });

  describe("byBookMarked Function", () => {
    it('should return a doc collection sorted by bookmarks and with the correct documents per bookmark', () => {
      addDocBookmarks(bookmarks, {
        ["Student 2 Problem Doc Group 3"]: [
          new Bookmark("1", "a", true),
        ],
        ["Student 1 Problem Doc Group 5"]: [
          new Bookmark("1", "a", true),
          new Bookmark("2", "b", true),
        ]
      });

      const documentsByGroup = sortedDocuments.sortBy("Group");
      const documentCollection = documentsByGroup[0].byBookmarked;
      expect(documentCollection.length).toBe(2);
      expect(documentCollection[0].label).toBe("Bookmarked");
      expect(documentCollection[0].documents.length).toBe(1);
      expect(documentCollection[1].label).toBe("Not Bookmarked");
      expect(documentCollection[1].documents.length).toBe(1);

      const documentCollection2 = documentsByGroup[1].byBookmarked;
      expect(documentCollection2.length).toBe(2);
      expect(documentCollection2[0].label).toBe("Bookmarked");
      expect(documentCollection2[0].documents.length).toBe(1);
      expect(documentCollection2[1].label).toBe("Not Bookmarked");
      expect(documentCollection2[1].documents.length).toBe(0);

      const documentCollection3 = documentsByGroup[2].byBookmarked;
      expect(documentCollection3.length).toBe(2);
      expect(documentCollection3[0].label).toBe("Bookmarked");
      expect(documentCollection3[0].documents.length).toBe(0);
      expect(documentCollection3[1].label).toBe("Not Bookmarked");
      expect(documentCollection3[1].documents.length).toBe(1);
    });
  });

  describe("byGroup Function", () => {
    it('should return a document collection sorted by group names and with the correct documents per group', () => {
      const expectedGroups = [
        { label: "Group 5", index: 0 },
        { label: "Group 9", index: 1 },
        { label: "Group 3", index: 2 },
        { label: "Group 3", index: 3 }
      ];
      const byNameGroups = sortedDocuments.sortBy("Name");
      expectedGroups.forEach(({ label, index }) => {
        const documentGroup = byNameGroups[index];
        const documentCollection = documentGroup.byGroup;
        expect(documentCollection.length).toBe(1);
        expect(documentCollection[0].label).toBe(label);
        expect(documentCollection[0].documents.length).toBe(1);
      });
    });

  });

  describe("byName Function", () => {
    it ('should return a document collection alphabetized by last name with the correct documents per user', () => {
      const byGroupDocs = sortedDocuments.sortBy("Group");
      const documentGroup = byGroupDocs[0];
      const documentCollection = documentGroup.byName;
      expect(documentCollection.length).toBe(2);
      expect(documentCollection[0].label).toBe("Cytacki, Scott");
      expect(documentCollection[0].documents.length).toBe(1);
      expect(documentCollection[1].label).toBe("Swenson, Kirk");
      expect(documentCollection[1].documents.length).toBe(1);

      const documentGroup2 = byGroupDocs[1];
      const documentCollection2 = documentGroup2.byName;
      expect(documentCollection2.length).toBe(1);
      expect(documentCollection2[0].label).toBe("Bacal, Joe");
      expect(documentCollection2[0].documents.length).toBe(1);

      const documentGroup3 = byGroupDocs[2];
      const documentCollection3 = documentGroup3.byName;
      expect(documentCollection3.length).toBe(1);
      expect(documentCollection3[0].label).toBe("Cao, Dennis");
      expect(documentCollection3[0].documents.length).toBe(1);
    });
  });

  describe("byStrategy Function", () => {
    it('should return a document collection sorted by strategy with the correct documents per strategy', () => {
      const byNameGroups = sortedDocuments.sortBy("Name");
      const documentGroup = byNameGroups[0];
      const documentCollection = documentGroup.byStrategy;
      expect(documentCollection.length).toBe(3); // 'Not Tagged' is added by default to the list of strategies
      expect(documentCollection[0].label).toBe("foo");
      expect(documentCollection[0].documents.length).toBe(1);
      expect(documentCollection[1].label).toBe("bar");
      expect(documentCollection[1].documents.length).toBe(1);
      expect(documentCollection[2].label).toBe("Not Tagged");
      expect(documentCollection[2].documents.length).toBe(0);

      const documentGroup2 = byNameGroups[1];
      const documentCollection2 = documentGroup2.byStrategy;
      expect(documentCollection2.length).toBe(3);
      expect(documentCollection2[0].label).toBe("foo");
      expect(documentCollection2[0].documents.length).toBe(0);
      expect(documentCollection2[1].label).toBe("bar");
      expect(documentCollection2[1].documents.length).toBe(0);
      expect(documentCollection2[2].label).toBe("Not Tagged");
      expect(documentCollection2[2].documents.length).toBe(1);

      const documentGroup3 = byNameGroups[2];
      const documentCollection3 = documentGroup3.byStrategy;
      expect(documentCollection3.length).toBe(3);
      expect(documentCollection3[0].label).toBe("foo");
      expect(documentCollection3[0].documents.length).toBe(0);
      expect(documentCollection3[1].label).toBe("bar");
      expect(documentCollection3[1].documents.length).toBe(0);
      expect(documentCollection3[2].label).toBe("Not Tagged");
      expect(documentCollection3[2].documents.length).toBe(1);

      const documentGroup4 = byNameGroups[3];
      const documentCollection4 = documentGroup4.byStrategy;
      expect(documentCollection4.length).toBe(3);
      expect(documentCollection4[0].label).toBe("foo");
      expect(documentCollection4[0].documents.length).toBe(0);
      expect(documentCollection4[1].label).toBe("bar");
      expect(documentCollection4[1].documents.length).toBe(1);
      expect(documentCollection4[2].label).toBe("Not Tagged");
      expect(documentCollection4[2].documents.length).toBe(0);
    });
  });

  describe("byTools Function", () => {
    it ('should return a document collection sorted by tool with the correct documents per tool', () => {
      const byGroupDocs = sortedDocuments.sortBy("Group");
      const documentGroup = byGroupDocs[0];
      const documentCollection = documentGroup.byTools;
      expect(documentCollection.length).toBe(2);
      expect(documentCollection[0].label).toBe("Text");
      expect(documentCollection[0].documents.length).toBe(1);
      expect(documentCollection[1].label).toBe("No Tools");
      expect(documentCollection[1].documents.length).toBe(1);

      const documentGroup2 = byGroupDocs[1];
      const documentCollection2 = documentGroup2.byTools;
      expect(documentCollection2.length).toBe(1);
      expect(documentCollection2[0].label).toBe("No Tools");
      expect(documentCollection2[0].documents.length).toBe(1);

      const documentGroup3 = byGroupDocs[2];
      const documentCollection3 = documentGroup3.byTools;
      expect(documentCollection3.length).toBe(1);
      expect(documentCollection3[0].label).toBe("Drawing");
      expect(documentCollection3[0].documents.length).toBe(1);
    });
  });

  describe("byProblem Function", () => {
    it('should return a document collection sorted by problem with correct documents per problem', () => {
      // Primary sort by Group, then secondary sort by Problem
      const byGroupDocs = sortedDocuments.sortBy("Group");

      // Group 3 has Scott (1.2) and Kirk (1.2) - both in Problem 1.2
      const documentGroup = byGroupDocs[0]; // Group 3
      const documentCollection = documentGroup.byProblem;
      expect(documentCollection.length).toBe(1);
      expect(documentCollection[0].label).toBe("Problem 1.2");
      expect(documentCollection[0].documents.length).toBe(2);

      // Group 5 has Joe (1.1) - in Problem 1.1
      const documentGroup2 = byGroupDocs[1]; // Group 5
      const documentCollection2 = documentGroup2.byProblem;
      expect(documentCollection2.length).toBe(1);
      expect(documentCollection2[0].label).toBe("Problem 1.1");
      expect(documentCollection2[0].documents.length).toBe(1);

      // Group 9 has Dennis (2.1) - in Problem 2.1
      const documentGroup3 = byGroupDocs[2]; // Group 9
      const documentCollection3 = documentGroup3.byProblem;
      expect(documentCollection3.length).toBe(1);
      expect(documentCollection3[0].label).toBe("Problem 2.1");
      expect(documentCollection3[0].documents.length).toBe(1);
    });

    it('should sort problems in correct order (by investigation then problem)', () => {
      // Primary sort by Problem to test the problem sorting directly
      const byProblemDocs = sortedDocuments.sortBy("Problem");
      expect(byProblemDocs.length).toBe(3);
      // Should be sorted: 1.1, 1.2, 2.1
      expect(byProblemDocs[0].label).toBe("Problem 1.1");
      expect(byProblemDocs[0].documents.length).toBe(1);
      expect(byProblemDocs[1].label).toBe("Problem 1.2");
      expect(byProblemDocs[1].documents.length).toBe(2);
      expect(byProblemDocs[2].label).toBe("Problem 2.1");
      expect(byProblemDocs[2].documents.length).toBe(1);
    });

    it('should sort "No Problem" to the end', () => {
      // Modify one document to not have problem info
      const metadataWithNoProblem: SnapshotIn<typeof MetadataDocMapModel> = {
        ...mockMetadataDocuments,
        "Student 1 Problem Doc Group 5": {
          ...mockMetadataDocuments["Student 1 Problem Doc Group 5"],
          investigation: undefined,
          problem: undefined
        }
      };
      sortedDocuments.metadataDocsFiltered = MetadataDocMapModel.create(metadataWithNoProblem);

      const byProblemDocs = sortedDocuments.sortBy("Problem");
      expect(byProblemDocs.length).toBe(3);
      expect(byProblemDocs[0].label).toBe("Problem 1.2");
      expect(byProblemDocs[0].documents.length).toBe(2);
      expect(byProblemDocs[1].label).toBe("Problem 2.1");
      expect(byProblemDocs[1].documents.length).toBe(1);
      expect(byProblemDocs[2].label).toBe("No Problem");
      expect(byProblemDocs[2].documents.length).toBe(1);
    });
  });

});
