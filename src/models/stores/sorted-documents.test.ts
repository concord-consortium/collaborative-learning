import { DocumentModelType, createDocumentModel, DocumentModelSnapshotType } from "../document/document";
import { GroupModel, GroupsModel, GroupsModelType, GroupUserModel } from './groups';
import { ClassModel, ClassModelType, ClassUserModel } from './class';
import { ProblemDocument } from '../document/document-types';
import { ISortedDocumentsStores, MetadataDocMapModel, SortedDocuments } from "./sorted-documents";
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


    const mockStores: DeepPartial<ISortedDocumentsStores> = {
      //DeepPartial allows us to not need to mock the "dB" and "appConfig" stores
      //as well not needing to type the stores below
      documents: { all: mockDocuments, exemplarDocuments: [] },
      groups: mockGroups,
      class: mockClass,
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
