import { DocumentModelType, createDocumentModel } from "../document/document";
import { GroupModel, GroupsModel, GroupsModelType, GroupUserModel } from './groups';
import { ClassModel, ClassModelType, ClassUserModel } from './class';
import { ProblemDocument } from '../document/document-types';
import { ISortedDocumentsStores, SortedDocuments } from "./sorted-documents";
import { DeepPartial } from "utility-types";


//****************************************** Documents Mock ***************************************

const mockDocumentsData = [
  {uid: "1", type: ProblemDocument, key:"Student 1 Problem Doc Group 5", groupId: "5", createdAt: 1}, //Joe
  {uid: "2", type: ProblemDocument, key:"Student 2 Problem Doc Group 3", groupId: "3", createdAt: 2}, //Scott
  {uid: "3", type: ProblemDocument, key:"Student 3 Problem Doc Group 9", groupId: "9", createdAt: 3}, //Dennis
  {uid: "4", type: ProblemDocument, key:"Student 4 Problem Doc Group 3", groupId: "3", createdAt: 4}  //Kirk
];

const createMockDocuments = () => {
  const mockDocuments: DocumentModelType[] = [];

  mockDocumentsData.forEach(docData => {
    const newDocument = createDocumentModel({
      uid: docData.uid,
      type: docData.type as typeof ProblemDocument,
      key: docData.key,
      groupId: docData.groupId,
      createdAt: docData.createdAt,
    });
    mockDocuments.push(newDocument);
  });
  return mockDocuments;
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
  name: string;
  initials: string;
  connectedTimestamp: number;
  disconnectedTimestamp?: number;
};

const createMockGroupUsers = (groupUsersData: GroupUserData[]) => {
  return groupUsersData.map(userData =>
    GroupUserModel.create({
      id: userData.id,
      name: userData.name,
      initials: userData.initials,
      connectedTimestamp: userData.connectedTimestamp,
      disconnectedTimestamp: userData.disconnectedTimestamp
    })
  );
};

const createMockGroups = () => {
  const group3UsersData = [
    { id: "2", name: "Scott Cytacki", initials: "SC", connectedTimestamp: 2 },
    { id: "4", name: "Kirk Swenson", initials: "KS", connectedTimestamp: 4 },
  ];
  const group5UsersData = [
    { id: "1", name: "Joe Bacal", initials: "JB", connectedTimestamp: 1 },
  ];
  const group9UsersData = [
    { id: "3", name: "Dennis Cao", initials: "DC", connectedTimestamp: 3 },
  ];

  const group3Users = createMockGroupUsers(group3UsersData);
  const group5Users = createMockGroupUsers(group5UsersData);
  const group9Users = createMockGroupUsers(group9UsersData);

  const mockGroups = GroupsModel.create({
    allGroups: [
      GroupModel.create({ id: "3", users: group3Users }),
      GroupModel.create({ id: "5", users: group5Users }),
      GroupModel.create({ id: "9", users: group9Users }),
    ]
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
      documents: { all: mockDocuments },
      groups: mockGroups,
      class: mockClass,
    };

    sortedDocuments = new SortedDocuments(mockStores as ISortedDocumentsStores);
  });


  describe('sortByGroup Function', () => {
    it('should correctly sort documents by group', () => {
      const sortedDocsByGroup = sortedDocuments.sortByGroup;
      expect(sortedDocsByGroup.length).toBe(3);
      const group3 = sortedDocsByGroup.find(group => group.sectionLabel === 'Group 3');
      expect(group3?.documents.length).toBe(2); // Group 3 - Kirk + Scott
      const group5 = sortedDocsByGroup.find(group => group.sectionLabel === 'Group 5');
      expect(group5?.documents.length).toBe(1); // Group 5 - Joe
      const group9 = sortedDocsByGroup.find(group => group.sectionLabel === 'Group 9');
      expect(group9?.documents.length).toBe(1); // Group 9 - Dennis
    });

    it('should sort the groups numerically from least to greatest', () => {
      //Verify "Group 3" comes before "Group 5" and before "Group 9"
      const sortedSectionLabels = sortedDocuments.sortByGroup.map(group => group.sectionLabel);
      expect(sortedSectionLabels).toEqual(['Group 3', 'Group 5', 'Group 9']);
    });
  });

  describe('sortByName Function', () => {
    it('should correctly sort documents by last name', () => {
      const expectedOrder = [
        "Bacal, Joe",
        "Cao, Dennis",
        "Cytacki, Scott",
        "Swenson, Kirk"
      ];
      const sortedDocsByName = sortedDocuments.sortByName;
      const actualOrder = sortedDocsByName.map(group => group.sectionLabel);
      expect(actualOrder).toEqual(expectedOrder);
    });
  });
});