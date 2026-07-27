import { DocumentModelType, createDocumentModel, DocumentModelSnapshotType } from "../document/document";
import { GroupModel, GroupsModel, GroupsModelType, GroupUserModel } from './groups';
import { ClassModel, ClassModelType, ClassUserModel } from './class';
import { ExemplarDocument, ProblemDocument } from '../document/document-types';
import { MetadataDocMapModel } from "../document/document-metadata-model";
import { ISortedDocumentsStores, SortedDocuments } from "./sorted-documents";
import { DocumentMetadataStore } from "./document-metadata-store";
import { DeepPartial } from "utility-types";
import { DocumentContentSnapshotType } from "../document/document-content";

import "../tiles/text/text-registration";
import "../../plugins/drawing/drawing-registration";
import { SnapshotIn } from "mobx-state-tree";

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
    type: ProblemDocument, key:"Student 1 Problem Doc Group 5", createdAt: 1,
    tools: []
  },
  "Student 2 Problem Doc Group 3": {
    uid: "2", //Scott
    type: ProblemDocument, key:"Student 2 Problem Doc Group 3", createdAt: 2,
    tools: ["Text"]
  },
  "Student 3 Problem Doc Group 9": {
    uid: "3", //Dennis
    type: ProblemDocument, key:"Student 3 Problem Doc Group 9", createdAt: 3,
    tools: ["Drawing"]
  },
  "Student 4 Problem Doc Group 3": {
    uid: "4", //Kirk
    type: ProblemDocument, key:"Student 4 Problem Doc Group 3", createdAt: 4,
    tools: []
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

//****************************************** Jest Tests *******************************************

describe('Sorted Documents Model', () => {
  let sortedDocuments: SortedDocuments;
  let mockDocuments: DocumentModelType[];
  let mockGroups: GroupsModelType;
  let mockClass: ClassModelType;

  beforeEach(() => {
    mockDocuments = createMockDocuments();
    mockGroups = createMockGroups();
    mockClass = createMockClassWithUsers();


    const documentMetadata = new DocumentMetadataStore(
      { db: {}, user: { classHash: "" }, documents: { exemplarDocuments: [] } } as any
    );

    const mockStores: DeepPartial<ISortedDocumentsStores> = {
      //DeepPartial allows us to not need to mock the "dB" and "appConfig" stores
      //as well not needing to type the stores below
      documents: { all: mockDocuments, exemplarDocuments: [] },
      groups: mockGroups,
      class: mockClass,
      documentMetadata,
    };

    sortedDocuments = new SortedDocuments(mockStores as ISortedDocumentsStores);
    sortedDocuments.metadataDocsFiltered = MetadataDocMapModel.create(mockMetadataDocuments);
  });


  describe('byGroup Function', () => {
    it('should correctly sort documents by group', () => {
      const sortedDocsByGroup = sortedDocuments.sortBy("Group");
      expect(sortedDocsByGroup.length).toBe(3);
      const group3 = sortedDocsByGroup.find(group => group.label === 'Group 3');
      expect(group3?.documents.length).toBe(2); // Group 3 - Kirk + Scott
      const group5 = sortedDocsByGroup.find(group => group.label === 'Group 5');
      expect(group5?.documents.length).toBe(1); // Group 5 - Joe
      const group9 = sortedDocsByGroup.find(group => group.label === 'Group 9');
      expect(group9?.documents.length).toBe(1); // Group 9 - Dennis
    });

    it('should sort the groups numerically from least to greatest', () => {
      //Verify "Group 3" comes before "Group 5" and before "Group 9"
      const sortedSectionLabels = sortedDocuments.sortBy("Group").map(group => group.label);
      expect(sortedSectionLabels).toEqual(['Group 3', 'Group 5', 'Group 9']);
    });
  });

  describe('exemplarMetadataDocs', () => {
    it('carries the exemplar document visibility so public exemplars render as shared, not private', () => {
      const exemplarDoc = createDocumentModel({
        uid: "ivan",
        type: ExemplarDocument,
        key: "exemplar-1",
        createdAt: 1,
        title: "First Exemplar",
        visibility: "public",
        content: { tiles: [] } as DocumentContentSnapshotType
      });
      const documentMetadataForExemplar = new DocumentMetadataStore(
        { db: {}, user: { classHash: "" }, documents: { exemplarDocuments: [exemplarDoc] } } as any
      );
      const stores: DeepPartial<ISortedDocumentsStores> = {
        documents: { all: [], exemplarDocuments: [exemplarDoc] },
        groups: mockGroups,
        class: mockClass,
        documentMetadata: documentMetadataForExemplar,
      };
      const sd = new SortedDocuments(stores as ISortedDocumentsStores);
      expect(sd.exemplarMetadataDocs.get("exemplar-1")?.visibility).toBe("public");
    });
  });

  describe('byName Function', () => {
    it('should correctly sort documents by last name', () => {
      const expectedOrder = [
        "Bacal, Joe",
        "Cao, Dennis",
        "Cytacki, Scott",
        "Swenson, Kirk"
      ];
      const sortedDocsByName = sortedDocuments.sortBy("Name");
      const actualOrder = sortedDocsByName.map(group => group.label);
      expect(actualOrder).toEqual(expectedOrder);
    });
  });

  describe('byTools Function', () => {
    it('should correctly sort documents by tool', () => {
      const sortedDocsByTools = sortedDocuments.sortBy("Tools");
      const summaryOfResult = sortedDocsByTools.map(section => ({
        sectionLabel: section.label,
        docKeys: section.documents.map(doc => doc.key)
      }));
      expect(summaryOfResult).toEqual([
        { sectionLabel: "Sketch", docKeys: [
          "Student 3 Problem Doc Group 9"
        ]},
        { sectionLabel: "Text", docKeys: [
          "Student 2 Problem Doc Group 3"
        ]},
        { sectionLabel: "No Tools", docKeys: [
          "Student 1 Problem Doc Group 5",
          "Student 4 Problem Doc Group 3"
        ]}
      ]);
    });
  });
});

type WhereClause = [string, string, any];

interface IMockQueryRecord {
  clauses: WhereClause[];
  emit: (docs: any[]) => void;
  disposed: boolean;
}

// Records every query built off db.firestore and lets a test drive each listener's snapshot.
function makeMockFirestore() {
  const listeners: IMockQueryRecord[] = [];
  const makeQuery = (clauses: WhereClause[]): any => ({
    withConverter: () => makeQuery(clauses),
    where: (field: string, op: string, value: any) => makeQuery([...clauses, [field, op, value]]),
    onSnapshot: (cb: (snap: any) => void) => {
      const record: IMockQueryRecord = {
        clauses,
        emit: (docs: any[]) => cb({ docs: docs.map(d => ({ data: () => d })) }),
        disposed: false
      };
      listeners.push(record);
      return () => { record.disposed = true; };
    }
  });
  return { listeners, collection: () => makeQuery([]) };
}

describe("SortedDocuments.watchFirestoreMetaDataDocs", () => {
  let firestore: ReturnType<typeof makeMockFirestore>;
  let sortedDocuments: SortedDocuments;

  const classWideMetadata = {
    uid: "class_mock", type: "group", key: "Class Wide Doc", createdAt: 7,
    unit: "sas", investigation: null, problem: null, kind: "drivingQuestionBoard", concurrent: true
  };

  beforeEach(() => {
    firestore = makeMockFirestore();
    const documentMetadata = new DocumentMetadataStore(
      { db: {}, user: { classHash: "mock" }, documents: { exemplarDocuments: [] } } as any
    );
    const mockStores: DeepPartial<ISortedDocumentsStores> = {
      documents: { all: [], exemplarDocuments: [] },
      db: { firestore } as any,
      user: { classHash: "mock" },
      curriculumConfig: { getUnitCodeVariants: (unit: string) => [unit] },
      documentMetadata,
    };
    sortedDocuments = new SortedDocuments(mockStores as ISortedDocumentsStores);
  });

  const unitScopedListener = () =>
    firestore.listeners.find(l =>
      l.clauses.some(([field, , value]) => field === "investigation" && value === null));

  it("adds a unit-scoped listener under the Problem filter", () => {
    sortedDocuments.watchFirestoreMetaDataDocs("Problem", "sas", 1, 2);
    const listener = unitScopedListener();
    expect(listener).toBeDefined();
    expect(listener?.clauses).toEqual([
      ["context_id", "==", "mock"],
      ["unit", "in", ["sas"]],
      ["investigation", "==", null],
    ]);
  });

  it("adds a unit-scoped listener under the Investigation filter", () => {
    sortedDocuments.watchFirestoreMetaDataDocs("Investigation", "sas", 1, 2);
    expect(unitScopedListener()).toBeDefined();
  });

  it("adds no unit-scoped listener under the All or Unit filters, which already include those docs", () => {
    sortedDocuments.watchFirestoreMetaDataDocs("All", "sas", 1, 2);
    expect(unitScopedListener()).toBeUndefined();

    firestore.listeners.length = 0;
    sortedDocuments.watchFirestoreMetaDataDocs("Unit", "sas", 1, 2);
    expect(unitScopedListener()).toBeUndefined();
  });

  it("surfaces unit-scoped documents in firestoreMetadataDocs", () => {
    sortedDocuments.watchFirestoreMetaDataDocs("Problem", "sas", 1, 2);
    unitScopedListener()?.emit([classWideMetadata]);
    expect(sortedDocuments.firestoreMetadataDocs.map(d => d.key)).toEqual(["Class Wide Doc"]);
  });

  it("does not list a document twice when both listeners return it", () => {
    sortedDocuments.watchFirestoreMetaDataDocs("Problem", "sas", 1, 2);
    firestore.listeners[0].emit([classWideMetadata]);   // the filtered listener
    unitScopedListener()?.emit([classWideMetadata]);
    expect(sortedDocuments.firestoreMetadataDocs.map(d => d.key)).toEqual(["Class Wide Doc"]);
  });

  it("disposes the unit-scoped listener with the others", () => {
    const dispose = sortedDocuments.watchFirestoreMetaDataDocs("Problem", "sas", 1, 2);
    const listener = unitScopedListener();
    dispose();
    expect(listener?.disposed).toBe(true);
  });

  it("clears previously fetched unit-scoped documents when the filter no longer needs them", () => {
    sortedDocuments.watchFirestoreMetaDataDocs("Problem", "sas", 1, 2);
    unitScopedListener()?.emit([classWideMetadata]);
    expect(sortedDocuments.firestoreMetadataDocs.length).toBe(1);

    firestore.listeners.length = 0;
    sortedDocuments.watchFirestoreMetaDataDocs("All", "sas", 1, 2);
    expect(sortedDocuments.firestoreMetadataDocs.length).toBe(0);
  });
});
