import { observable } from "mobx";
import { mock } from "ts-jest-mocker";
import { DeepPartial } from "utility-types";
import { SnapshotIn } from "mobx-state-tree";

import { clearTermOverrides, setTermOverrides } from "../../utilities/translation/translate";
import { createDocumentModel, DocumentModelSnapshotType, DocumentModelType } from "../document/document";
import { DocumentContentSnapshotType } from "../document/document-content";
import { GroupDocument, ProblemDocument } from '../document/document-types';
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
  },
  { uid: "2", //Scott (group doc for group 3)
    type: GroupDocument, key:"Group 3 Group Doc", groupId: "3", createdAt: 5,
    content: { tiles: [] } as DocumentContentSnapshotType
  },
  { uid: "1", //Joe (group doc for group 5)
    type: GroupDocument, key:"Group 5 Group Doc", groupId: "5", createdAt: 6,
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
  },
  "Group 3 Group Doc": {
    uid: "2",
    type: GroupDocument, key:"Group 3 Group Doc", createdAt: 5,
    tools: [],
    groupId: "3",
    investigation: "1",
    problem: "2"
  },
  "Group 5 Group Doc": {
    uid: "1",
    type: GroupDocument, key:"Group 5 Group Doc", createdAt: 6,
    tools: [],
    groupId: "5",
    investigation: "1",
    problem: "1"
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
        commentTags: {"foo": "foo", "bar": "bar"}
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

      // Group 3: Scott (bookmarked), Kirk (not), Group 3 group doc (not)
      const documentCollection = documentsByGroup[0].byBookmarked;
      expect(documentCollection.length).toBe(2);
      expect(documentCollection[0].label).toBe("Bookmarked");
      expect(documentCollection[0].documents.length).toBe(1);
      expect(documentCollection[1].label).toBe("Not Bookmarked");
      expect(documentCollection[1].documents.length).toBe(2);

      // Group 5: Joe (bookmarked), Group 5 group doc (not)
      const documentCollection2 = documentsByGroup[1].byBookmarked;
      expect(documentCollection2.length).toBe(2);
      expect(documentCollection2[0].label).toBe("Bookmarked");
      expect(documentCollection2[0].documents.length).toBe(1);
      expect(documentCollection2[1].label).toBe("Not Bookmarked");
      expect(documentCollection2[1].documents.length).toBe(1);

      // Group 9: Dennis (not bookmarked)
      const documentCollection3 = documentsByGroup[2].byBookmarked;
      expect(documentCollection3.length).toBe(2);
      expect(documentCollection3[0].label).toBe("Bookmarked");
      expect(documentCollection3[0].documents.length).toBe(0);
      expect(documentCollection3[1].label).toBe("Not Bookmarked");
      expect(documentCollection3[1].documents.length).toBe(1);
    });
  });

  describe("byGroup Function", () => {
    afterEach(() => {
      clearTermOverrides();
    });

    it('should return a document collection sorted by group names and with the correct documents per group', () => {
      const byNameGroups = sortedDocuments.sortBy("Name");

      // Bacal, Joe: 1 personal doc + 1 Group 5 group doc, all in Group 5
      const collection0 = byNameGroups[0].byGroup;
      expect(collection0.length).toBe(1);
      expect(collection0[0].label).toBe("Group 5");
      expect(collection0[0].documents.length).toBe(2);

      // Cao, Dennis: 1 personal doc in Group 9
      const collection1 = byNameGroups[1].byGroup;
      expect(collection1.length).toBe(1);
      expect(collection1[0].label).toBe("Group 9");
      expect(collection1[0].documents.length).toBe(1);

      // Cytacki, Scott: 1 personal doc + 1 Group 3 group doc, all in Group 3
      const collection2 = byNameGroups[2].byGroup;
      expect(collection2.length).toBe(1);
      expect(collection2[0].label).toBe("Group 3");
      expect(collection2[0].documents.length).toBe(2);

      // Swenson, Kirk: 1 personal doc + 1 Group 3 group doc, all in Group 3
      const collection3 = byNameGroups[3].byGroup;
      expect(collection3.length).toBe(1);
      expect(collection3[0].label).toBe("Group 3");
      expect(collection3[0].documents.length).toBe(2);
    });

    it('should use custom group term when term override is set', () => {
      setTermOverrides({ studentGroup: "Team" });

      const byNameGroups = sortedDocuments.sortBy("Name");

      // Bacal, Joe: Group 5
      const collection0 = byNameGroups[0].byGroup;
      expect(collection0.length).toBe(1);
      expect(collection0[0].label).toBe("Team 5");
      expect(collection0[0].documents.length).toBe(2);

      // Cao, Dennis: Group 9
      const collection1 = byNameGroups[1].byGroup;
      expect(collection1.length).toBe(1);
      expect(collection1[0].label).toBe("Team 9");
      expect(collection1[0].documents.length).toBe(1);

      // Cytacki, Scott: Group 3
      const collection2 = byNameGroups[2].byGroup;
      expect(collection2.length).toBe(1);
      expect(collection2[0].label).toBe("Team 3");
      expect(collection2[0].documents.length).toBe(2);

      // Swenson, Kirk: Group 3
      const collection3 = byNameGroups[3].byGroup;
      expect(collection3.length).toBe(1);
      expect(collection3[0].label).toBe("Team 3");
      expect(collection3[0].documents.length).toBe(2);
    });

  });

  describe("byName Function", () => {
    it ('should return a document collection alphabetized by last name with the correct documents per user', () => {
      const byGroupDocs = sortedDocuments.sortBy("Group");
      // Group 3: Scott, Kirk, and Group 3 group doc
      const documentGroup = byGroupDocs[0];
      const documentCollection = documentGroup.byName;
      expect(documentCollection.length).toBe(2);
      expect(documentCollection[0].label).toBe("Cytacki, Scott");
      // Scott gets his own doc + the Group 3 group doc
      expect(documentCollection[0].documents.length).toBe(2);
      expect(documentCollection[1].label).toBe("Swenson, Kirk");
      // Kirk gets his own doc + the Group 3 group doc
      expect(documentCollection[1].documents.length).toBe(2);

      // Group 5: Joe and Group 5 group doc
      const documentGroup2 = byGroupDocs[1];
      const documentCollection2 = documentGroup2.byName;
      expect(documentCollection2.length).toBe(1);
      expect(documentCollection2[0].label).toBe("Bacal, Joe");
      // Joe gets his own doc + the Group 5 group doc
      expect(documentCollection2[0].documents.length).toBe(2);

      // Group 9: Dennis (no group doc for group 9)
      const documentGroup3 = byGroupDocs[2];
      const documentCollection3 = documentGroup3.byName;
      expect(documentCollection3.length).toBe(1);
      expect(documentCollection3[0].label).toBe("Cao, Dennis");
      expect(documentCollection3[0].documents.length).toBe(1);
    });

    it('should include group documents under each member of the group', () => {
      // Sort directly by Name to test the top-level byName behavior
      const byNameDocs = sortedDocuments.sortBy("Name");
      // Should have 4 name sections (alphabetical): Bacal, Cao, Cytacki, Swenson
      expect(byNameDocs.length).toBe(4);

      // Bacal, Joe (Group 5) - own doc + Group 5 group doc
      expect(byNameDocs[0].label).toBe("Bacal, Joe");
      expect(byNameDocs[0].documents.length).toBe(2);
      expect(byNameDocs[0].documents.some(d => d.key === "Student 1 Problem Doc Group 5")).toBe(true);
      expect(byNameDocs[0].documents.some(d => d.key === "Group 5 Group Doc")).toBe(true);

      // Cao, Dennis (Group 9) - own doc only (no group doc for group 9)
      expect(byNameDocs[1].label).toBe("Cao, Dennis");
      expect(byNameDocs[1].documents.length).toBe(1);
      expect(byNameDocs[1].documents[0].key).toBe("Student 3 Problem Doc Group 9");

      // Cytacki, Scott (Group 3) - own doc + Group 3 group doc
      expect(byNameDocs[2].label).toBe("Cytacki, Scott");
      expect(byNameDocs[2].documents.length).toBe(2);
      expect(byNameDocs[2].documents.some(d => d.key === "Student 2 Problem Doc Group 3")).toBe(true);
      expect(byNameDocs[2].documents.some(d => d.key === "Group 3 Group Doc")).toBe(true);

      // Swenson, Kirk (Group 3) - own doc + Group 3 group doc
      expect(byNameDocs[3].label).toBe("Swenson, Kirk");
      expect(byNameDocs[3].documents.length).toBe(2);
      expect(byNameDocs[3].documents.some(d => d.key === "Student 4 Problem Doc Group 3")).toBe(true);
      expect(byNameDocs[3].documents.some(d => d.key === "Group 3 Group Doc")).toBe(true);
    });

    it('should not create a separate name section for group documents', () => {
      const byNameDocs = sortedDocuments.sortBy("Name");
      // Group documents should not appear as their own name entry
      const labels = byNameDocs.map(d => d.label);
      expect(labels).not.toContain("Unknown");
      expect(labels).toEqual(["Bacal, Joe", "Cao, Dennis", "Cytacki, Scott", "Swenson, Kirk"]);
    });
  });

  describe("byStrategy Function", () => {
    it('should return a document collection sorted by strategy with the correct documents per strategy', () => {
      const byNameGroups = sortedDocuments.sortBy("Name");

      // Bacal, Joe: problem doc has ["foo", "bar"], group doc has none
      const documentCollection = byNameGroups[0].byStrategy;
      expect(documentCollection.length).toBe(3); // 'Not Tagged' is added by default to the list of strategies
      expect(documentCollection[0].label).toBe("foo");
      expect(documentCollection[0].documents.length).toBe(1);
      expect(documentCollection[1].label).toBe("bar");
      expect(documentCollection[1].documents.length).toBe(1);
      expect(documentCollection[2].label).toBe("Not Tagged");
      expect(documentCollection[2].documents.length).toBe(1); // Group 5 group doc

      // Cao, Dennis: 1 problem doc with no strategies
      const documentCollection2 = byNameGroups[1].byStrategy;
      expect(documentCollection2.length).toBe(3);
      expect(documentCollection2[0].label).toBe("foo");
      expect(documentCollection2[0].documents.length).toBe(0);
      expect(documentCollection2[1].label).toBe("bar");
      expect(documentCollection2[1].documents.length).toBe(0);
      expect(documentCollection2[2].label).toBe("Not Tagged");
      expect(documentCollection2[2].documents.length).toBe(1);

      // Cytacki, Scott: problem doc with no strategies + Group 3 group doc with no strategies
      const documentCollection3 = byNameGroups[2].byStrategy;
      expect(documentCollection3.length).toBe(3);
      expect(documentCollection3[0].label).toBe("foo");
      expect(documentCollection3[0].documents.length).toBe(0);
      expect(documentCollection3[1].label).toBe("bar");
      expect(documentCollection3[1].documents.length).toBe(0);
      expect(documentCollection3[2].label).toBe("Not Tagged");
      expect(documentCollection3[2].documents.length).toBe(2);

      // Swenson, Kirk: problem doc has ["bar"] + Group 3 group doc with no strategies
      const documentCollection4 = byNameGroups[3].byStrategy;
      expect(documentCollection4.length).toBe(3);
      expect(documentCollection4[0].label).toBe("foo");
      expect(documentCollection4[0].documents.length).toBe(0);
      expect(documentCollection4[1].label).toBe("bar");
      expect(documentCollection4[1].documents.length).toBe(1);
      expect(documentCollection4[2].label).toBe("Not Tagged");
      expect(documentCollection4[2].documents.length).toBe(1); // Group 3 group doc
    });
  });

  describe("byTools Function", () => {
    it ('should return a document collection sorted by tool with the correct documents per tool', () => {
      const byGroupDocs = sortedDocuments.sortBy("Group");

      // Group 3: Scott (Text), Kirk (no tools), Group 3 group doc (no tools)
      const documentCollection = byGroupDocs[0].byTools;
      expect(documentCollection.length).toBe(2);
      expect(documentCollection[0].label).toBe("Text");
      expect(documentCollection[0].documents.length).toBe(1);
      expect(documentCollection[1].label).toBe("No Tools");
      expect(documentCollection[1].documents.length).toBe(2);

      // Group 5: Joe (no tools), Group 5 group doc (no tools)
      const documentCollection2 = byGroupDocs[1].byTools;
      expect(documentCollection2.length).toBe(1);
      expect(documentCollection2[0].label).toBe("No Tools");
      expect(documentCollection2[0].documents.length).toBe(2);

      // Group 9: Dennis (Drawing)
      const documentCollection3 = byGroupDocs[2].byTools;
      expect(documentCollection3.length).toBe(1);
      expect(documentCollection3[0].label).toBe("Drawing");
      expect(documentCollection3[0].documents.length).toBe(1);
    });
  });

  describe("byProblem Function", () => {
    it('should return a document collection sorted by problem with correct documents per problem', () => {
      // Primary sort by Group, then secondary sort by Problem
      const byGroupDocs = sortedDocuments.sortBy("Group");

      // Group 3: Scott (1.2), Kirk (1.2), Group 3 group doc (1.2)
      const documentCollection = byGroupDocs[0].byProblem;
      expect(documentCollection.length).toBe(1);
      expect(documentCollection[0].label).toBe("Problem 1.2");
      expect(documentCollection[0].documents.length).toBe(3);

      // Group 5: Joe (1.1), Group 5 group doc (1.1)
      const documentCollection2 = byGroupDocs[1].byProblem;
      expect(documentCollection2.length).toBe(1);
      expect(documentCollection2[0].label).toBe("Problem 1.1");
      expect(documentCollection2[0].documents.length).toBe(2);

      // Group 9: Dennis (2.1)
      const documentCollection3 = byGroupDocs[2].byProblem;
      expect(documentCollection3.length).toBe(1);
      expect(documentCollection3[0].label).toBe("Problem 2.1");
      expect(documentCollection3[0].documents.length).toBe(1);
    });

    it('should sort problems in correct order (by investigation then problem)', () => {
      const byProblemDocs = sortedDocuments.sortBy("Problem");
      expect(byProblemDocs.length).toBe(3);
      // Should be sorted: 1.1, 1.2, 2.1
      expect(byProblemDocs[0].label).toBe("Problem 1.1");
      expect(byProblemDocs[0].documents.length).toBe(2); // Joe + Group 5 group doc
      expect(byProblemDocs[1].label).toBe("Problem 1.2");
      expect(byProblemDocs[1].documents.length).toBe(3); // Scott + Kirk + Group 3 group doc
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
      expect(byProblemDocs.length).toBe(4);
      expect(byProblemDocs[0].label).toBe("Problem 1.1");
      expect(byProblemDocs[0].documents.length).toBe(1); // Group 5 group doc
      expect(byProblemDocs[1].label).toBe("Problem 1.2");
      expect(byProblemDocs[1].documents.length).toBe(3); // Scott + Kirk + Group 3 group doc
      expect(byProblemDocs[2].label).toBe("Problem 2.1");
      expect(byProblemDocs[2].documents.length).toBe(1);
      expect(byProblemDocs[3].label).toBe("No Problem");
      expect(byProblemDocs[3].documents.length).toBe(1);
    });
  });

});
