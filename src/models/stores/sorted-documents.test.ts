import { DocumentModelType, createDocumentModel } from "../document/document";
import { GroupModel, GroupsModel, GroupsModelType, GroupUserModel } from './groups';
import { ClassModel, ClassModelType, ClassUserModel } from './class';
import { ProblemDocument } from '../document/document-types';
import { SortedDocuments } from "./sorted-documents";

//****************************************** Documents Mock ***************************************

const mockDocumentsData = [
  {uid: "1", type: ProblemDocument, key:"Student 1 Problem Doc Group 5", groupId: 5, createdAt: 1},
  {uid: "2", type: ProblemDocument, key:"Student 2 Problem Doc Group 3", groupId: 3, createdAt: 2},
  {uid: "3", type: ProblemDocument, key:"Student 3 Problem Doc Group 9", groupId: 9, createdAt: 3},
  {uid: "4", type: ProblemDocument, key:"Student 4 Problem Doc Group 3", groupId: 3, createdAt: 4}
];

const createMockDocuments = () => {
  const mockDocuments: DocumentModelType[] = [];

  mockDocumentsData.forEach(docData => {
    const newDocument = createDocumentModel({
      type: docData.type as typeof ProblemDocument,
      uid: docData.uid,
      key: docData.key,
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
            fullName: "Joe Bacal", initials: "JB"}),
    "2": ClassUserModel.create(
          { type: "student", id: "2", firstName: "Scott", lastName: "Cytacki",
            fullName: "Scott Cytacki", initials: "SC" }),
    "3": ClassUserModel.create(
          { type: "student", id: "3", firstName: "Dennis", lastName: "Cao",
            fullName: "Dennis Cao", initials: "DC" }),
  };
};
const createMockClassWithUsers = () => {
  const mockUsers = createMockClassUsers();
  const mockClass = ClassModel.create({
    name: "Test Class",
    classHash: "test",
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
  const group1UsersData = [
    { id: "1", name: "User 1", initials: "U1", connectedTimestamp: 1 },
  ];
  const group2UsersData = [
    { id: "2", name: "User 2", initials: "U2", connectedTimestamp: 2 },
  ];

  const group1Users = createMockGroupUsers(group1UsersData);
  const group2Users = createMockGroupUsers(group2UsersData);

  const mockGroups = GroupsModel.create({
    allGroups: [
      GroupModel.create({ id: "Group 1", users: group1Users }),
      GroupModel.create({ id: "Group 2", users: group2Users }),
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

    const mockStores = {
      documents: { all: mockDocuments },
      groups: mockGroups,
      class: mockClass,
    };

    sortedDocuments = new SortedDocuments(mockStores);
  });

  //Test Sort By Group

  describe('sortByGroup Function', () => {
    //dennis notes - nested describe function should run the beforeEach above
    it('should correctly sort documents by group', () => {
      const expectedSortedArray = [
        { sectionLabel: 'Group 3', documents: [mockDocumentsData[1], mockDocumentsData[3]] },
        { sectionLabel: 'Group 5', documents: [mockDocumentsData[0]] },
        { sectionLabel: 'Group 9', documents: [mockDocumentsData[2]] },
      ];
      expect(sortedDocuments.sortByGroup).toEqual(expectedSortedArray);
    });

  });
});
