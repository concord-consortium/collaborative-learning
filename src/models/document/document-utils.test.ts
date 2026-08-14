import { UnitModel } from "../curriculum/unit";
import { AppConfigModel } from "../stores/app-config-model";
import { UserModel } from "../stores/user";
import { DocumentMetadataModel } from "../document/document-metadata-model";
import { createDocumentModel } from "./document";
import { ExemplarDocument, GroupDocument, PersonalDocument, ProblemDocument, ProblemPublication,
  SupportPublication } from "./document-types";
import { canUserEditDocument, getDocumentDisplayTitle, isDocumentAccessibleToUser } from "./document-utils";
import { ClassWideDocument } from "./document-kinds";
import { unitConfigDefaults } from "../../test-fixtures/sample-unit-configurations";

describe("document utils", () => {
  describe("getDocumentDisplayTitle", () => {
    describe("support documents", () => {
      test("without caption", () => {
        const metadata = DocumentMetadataModel.create({
          type: SupportPublication,
          uid: "123",
          key: "123",
        });
        const unit = UnitModel.create({
          code: "test",
          title: "test"
        });
        const appConfig = AppConfigModel.create();
        const title = getDocumentDisplayTitle(unit, metadata, appConfig);
        expect(title).toBe("Support");
      });
      test("with caption", () => {
        const metadata = DocumentMetadataModel.create({
          type: SupportPublication,
          uid: "123",
          key: "123",
          properties: {
            caption: "Test Title"
          }
        });
        const unit = UnitModel.create({
          code: "test",
          title: "test"
        });
        const appConfig = AppConfigModel.create();
        const title = getDocumentDisplayTitle(unit, metadata, appConfig);
        expect(title).toBe("Test Title");
      });
    });

    describe("personal documents", () => {
      test("without title", () => {
        const metadata = DocumentMetadataModel.create({
          type: PersonalDocument,
          uid: "123",
          key: "123",
        });
        const unit = UnitModel.create({
          code: "test",
          title: "test"
        });
        const appConfig = AppConfigModel.create({config: unitConfigDefaults});
        const title = getDocumentDisplayTitle(unit, metadata, appConfig);
        expect(title).toBe(null);
      });

      test("with a title", () => {
        const metadata = DocumentMetadataModel.create({
          type: PersonalDocument,
          uid: "123",
          key: "123",
          title: "Test Title"
        });
        const unit = UnitModel.create({
          code: "test",
          title: "test"
        });
        const appConfig = AppConfigModel.create({config: unitConfigDefaults});
        const title = getDocumentDisplayTitle(unit, metadata, appConfig);
        expect(title).toBe("Test Title");
      });

      // NOTE: the default appConfig does not configure a timestamp property
      // and none of the production units set this property.
      // So really this timestamp feature is dead code in production
      test("with a title and configured timestamp property", () => {
        const metadata = DocumentMetadataModel.create({
          type: PersonalDocument,
          uid: "123",
          key: "123",
          title: "Test Title",
          properties: {
           timeStamp: "193899600000"
          }
        });
        const unit = UnitModel.create({
          code: "test",
          title: "test"
        });
        const appConfig = AppConfigModel.create({config: unitConfigDefaults});
        const title = getDocumentDisplayTitle(unit, metadata, appConfig);
        // The specified timestamp can be interpreted as on the 22nd or 23rd, depending on the local time zone.
        expect(title).toMatch(/Test Title \(2[23]FEB76-..:..:..\)/);
      });
    });

    describe("problem documents", () => {
      test("without a unit", () => {
        const metadata = DocumentMetadataModel.create({
          type: ProblemDocument,
          uid: "123",
          key: "123",
        });
        const unit = UnitModel.create({
          code: "test",
          title: "test"
        });
        const appConfig = AppConfigModel.create({config: unitConfigDefaults});
        const title = getDocumentDisplayTitle(unit, metadata, appConfig);
        expect(title).toBe("Problem doc without unit");
      });
      test("from another unit", () => {
        const metadata = DocumentMetadataModel.create({
          type: ProblemDocument,
          uid: "123",
          key: "123",
          unit: "other",
          investigation: "1",
          problem: "1"
        });
        const unit = UnitModel.create({
          code: "test",
          title: "test"
        });
        const appConfig = AppConfigModel.create({config: unitConfigDefaults});
        const title = getDocumentDisplayTitle(unit, metadata, appConfig);
        expect(title).toBe("Problem doc from other-1.1");
      });
      test("from the same unit but for a problem that doesn't exist", () => {
        const metadata = DocumentMetadataModel.create({
          type: ProblemDocument,
          uid: "123",
          key: "123",
          unit: "test",
          investigation: "1",
          problem: "1"
        });
        const unit = UnitModel.create({
          code: "test",
          title: "test"
        });
        const appConfig = AppConfigModel.create({config: unitConfigDefaults});
        const title = getDocumentDisplayTitle(unit, metadata, appConfig);
        expect(title).toBe("Problem doc from test-1.1");
      });
      test("from the same unit", () => {
        const metadata = DocumentMetadataModel.create({
          type: ProblemDocument,
          uid: "123",
          key: "123",
          unit: "test",
          investigation: "1",
          problem: "1"
        });
        const unit = UnitModel.create({
          code: "test",
          title: "Test Unit",
          investigations: [
            {
              ordinal: 1,
              title: "Test Investigation",
              problems: [
                {
                  ordinal: 1,
                  title: "Test Problem"
                }
              ]
            }
          ]
        });
        const appConfig = AppConfigModel.create({config: unitConfigDefaults});
        const title = getDocumentDisplayTitle(unit, metadata, appConfig);
        expect(title).toBe("Test Problem");
      });
    });

    describe("group documents", () => {
      const unit = UnitModel.create({ code: "test", title: "test" });
      const appConfig = AppConfigModel.create({ config: unitConfigDefaults });

      test("a regular group document uses the group label", () => {
        const metadata = DocumentMetadataModel.create({
          type: GroupDocument, kind: GroupDocument, uid: "g", key: "g1", groupId: "3"
        });
        expect(getDocumentDisplayTitle(unit, metadata, appConfig)).toBe("Group 3 Document");
      });

      test("a class-wide document uses the title stored on it, not one resolved from its kind", () => {
        const metadata = DocumentMetadataModel.create({
          // type stays "group"; the kind supplies no title, so the stored one names the document.
          type: GroupDocument, kind: ClassWideDocument, variant: "drivingQuestionBoard",
          uid: "class_c1", key: "dqb-1",
          title: "Driving Question Board", unit: "test", investigation: null, problem: null
        });
        expect(getDocumentDisplayTitle(unit, metadata, appConfig)).toBe("Driving Question Board");
      });
    });

    describe("class-wide documents from another unit", () => {
      // Under the Sort Work "All" filter a class sees every document it owns, including class-wide
      // documents from units it has already worked through, whose configs are not loaded.
      const unit = UnitModel.create({ code: "test", title: "test" });
      const appConfig = AppConfigModel.create({ config: unitConfigDefaults });

      test("names the document by its stored title, said to be from its own unit", () => {
        // The title travels with the document, so it reads the same wherever it is listed. The unit is
        // added back because that is the scope the title was authored to be unique within — two units may
        // each author a "Driving Question Board".
        const metadata = DocumentMetadataModel.create({
          type: GroupDocument, kind: ClassWideDocument, variant: "drivingQuestionBoard",
          uid: "class_c1", key: "dqb-other",
          title: "Our Big Questions", unit: "other", investigation: null, problem: null
        });
        expect(getDocumentDisplayTitle(unit, metadata, appConfig)).toBe("Our Big Questions (other)");
      });

      test("does not add the unit to a document from the unit being viewed", () => {
        const metadata = DocumentMetadataModel.create({
          type: GroupDocument, kind: ClassWideDocument, variant: "drivingQuestionBoard",
          uid: "class_c1", key: "dqb-own",
          title: "Our Big Questions", unit: "test", investigation: null, problem: null
        });
        expect(getDocumentDisplayTitle(unit, metadata, appConfig)).toBe("Our Big Questions");
      });

      test("falls back to the kind and unit for a document created before titles were stored", () => {
        const metadata = DocumentMetadataModel.create({
          type: GroupDocument, kind: ClassWideDocument, variant: "drivingQuestionBoard",
          uid: "class_c1", key: "dqb-untitled",
          unit: "other", investigation: null, problem: null
        });
        expect(getDocumentDisplayTitle(unit, metadata, appConfig)).toBe("Driving Question Board (other)");
      });

      test("falls back to the kind alone when the document has no unit", () => {
        const metadata = DocumentMetadataModel.create({
          type: GroupDocument, kind: ClassWideDocument, variant: "drivingQuestionBoard",
          uid: "class_c1", key: "dqb-no-unit"
        });
        expect(getDocumentDisplayTitle(unit, metadata, appConfig)).toBe("Driving Question Board");
      });
    });
  });

  describe("canUserEditDocument", () => {
    const student = UserModel.create({ id: "me", type: "student", name: "Me", classHash: "class-1" });
    const kOffering = "off-1";
    // A group document's owner, the same synthetic id the app stamps at creation.
    const groupOwner = (groupId: string, offeringId = kOffering) => `group_${offeringId}_${groupId}`;
    const groupedStudent = UserModel.create({
      id: "me", type: "student", name: "Me", classHash: "class-1",
      currentGroupId: "3", offeringId: kOffering
    });
    const teacher = UserModel.create({ id: "t1", type: "teacher", name: "Teacher", classHash: "class-1" });
    const researcher = UserModel.create({ id: "r1", type: "researcher", name: "Researcher", classHash: "class-1" });

    const metadata = (props: Record<string, any>) =>
      DocumentMetadataModel.create({ uid: "someone-else", type: GroupDocument, key: "k", ...props });

    /**
     * A group document as the app actually stamps it: kept in an offering, so it carries an
     * `offeringId` and the owning class. Both matter — without the `offeringId` the document reads as
     * class-wide, and the class check would then let any classmate edit another group's work.
     */
    const groupDocMetadata = (groupId: string, offeringId = kOffering) => metadata({
      uid: groupOwner(groupId, offeringId), concurrent: true, groupId,
      unit: "sas", investigation: "1", problem: "2", offeringId, context_id: "class-1"
    });

    it("allows a user to edit their own document", () => {
      expect(canUserEditDocument({
        documentMetadata: metadata({ uid: "me", type: ProblemDocument }), user: student
      })).toBe(true);
    });

    it("refuses another student's single-writer document", () => {
      expect(canUserEditDocument({
        documentMetadata: metadata({ type: ProblemDocument }), user: student
      })).toBe(false);
    });

    it("allows a member of the owning group to edit a group document", () => {
      expect(canUserEditDocument({
        documentMetadata: groupDocMetadata("3"), user: groupedStudent
      })).toBe(true);
    });

    it("refuses another group's document, even to a classmate of its owners", () => {
      // The document is in this student's own class, so only its offering keeps the class-wide branch
      // from reaching it.
      expect(canUserEditDocument({
        documentMetadata: groupDocMetadata("7"), user: groupedStudent
      })).toBe(false);
    });

    it("refuses the same group number in a different offering — a different set of students", () => {
      // Sort Work's "All" filter lists documents from every offering the class has worked through,
      // so this document does reach the check. Group ids are unique only within an offering.
      expect(canUserEditDocument({
        documentMetadata: groupDocMetadata("3", "other-offering"), user: groupedStudent
      })).toBe(false);
    });

    it("refuses a group document when the user is not in a group", () => {
      expect(canUserEditDocument({
        documentMetadata: groupDocMetadata("3"), user: student
      })).toBe(false);
    });

    it("allows any member of the class to edit a class-wide document", () => {
      expect(canUserEditDocument({
        documentMetadata: metadata({
          concurrent: true, unit: "sas", investigation: null, context_id: "class-1"
        }),
        user: student
      })).toBe(true);
    });

    it("refuses a class-wide document belonging to another class", () => {
      expect(canUserEditDocument({
        documentMetadata: metadata({
          concurrent: true, unit: "sas", investigation: null, context_id: "class-2"
        }),
        user: student
      })).toBe(false);
    });

    // An exemplar belongs to no offering, so it sits in the same container as a class-wide document
    // and `isInClassUnitContainer` is true for it. What keeps it read-only is that it is single-writer.
    it("refuses a curriculum exemplar", () => {
      expect(canUserEditDocument({
        document: createDocumentModel({
          uid: "ivan_idea_1", type: ExemplarDocument, key: "ex-1",
          unit: "sas", investigation: "1", problem: "2"
        }),
        user: student
      })).toBe(false);
    });

    it("refuses the metadata record written when a teacher comments on an exemplar", () => {
      // Unlike the curriculum document it mirrors, this record is stamped with the commenting class's
      // `context_id` (create-firestore-metadata-document.ts), so the class check inside the container
      // branch would pass. Being single-writer is the only thing standing between it and an Edit button.
      expect(canUserEditDocument({
        documentMetadata: metadata({
          uid: "ivan_idea_1", type: ExemplarDocument,
          unit: "sas", investigation: "1", problem: "2", context_id: "class-1"
        }),
        user: student
      })).toBe(false);
    });

    it("refuses a document that is not concurrent even inside the user's own scope", () => {
      expect(canUserEditDocument({
        documentMetadata: metadata({ unit: "sas", investigation: null, context_id: "class-1" }),
        user: student
      })).toBe(false);
    });

    it("returns false when neither a document nor metadata is supplied", () => {
      expect(canUserEditDocument({ user: student })).toBe(false);
    });

    it("refuses a user's own published document — publishing copies it under the publisher's uid," +
       " it is not a live editable document", () => {
      expect(canUserEditDocument({
        documentMetadata: metadata({ uid: "me", type: ProblemPublication }), user: student
      })).toBe(false);
    });

    it("refuses a researcher editing a class-wide document even though their classHash matches", () => {
      expect(canUserEditDocument({
        documentMetadata: metadata({
          concurrent: true, unit: "sas", investigation: null, context_id: "class-1"
        }),
        user: researcher
      })).toBe(false);
    });

    it("allows a teacher to edit a class-wide document belonging to their class", () => {
      expect(canUserEditDocument({
        documentMetadata: metadata({
          concurrent: true, unit: "sas", investigation: null, context_id: "class-1"
        }),
        user: teacher
      })).toBe(true);
    });

    it("refuses a class-wide document when context_id and the user's classHash are both empty", () => {
      // Guards the `!!contextId &&` check: without it, an empty-string context_id would equal a
      // user's default empty-string classHash and incorrectly grant access.
      const noClassUser = UserModel.create({ id: "me", type: "student", name: "Me" });
      expect(noClassUser.classHash).toBe("");
      expect(canUserEditDocument({
        documentMetadata: metadata({
          concurrent: true, unit: "sas", investigation: null, context_id: ""
        }),
        user: noClassUser
      })).toBe(false);
    });

    it("prefers the reactive metadata's owner over a still-loading document", () => {
      // A groupmate's document syncs into the metadata before its content finishes loading; reading
      // the metadata per field is what makes the Edit button appear without a reload.
      const stillLoading = createDocumentModel({
        uid: "", type: GroupDocument, key: "k", concurrent: true
      });
      expect(canUserEditDocument({
        document: stillLoading,
        documentMetadata: metadata({
          uid: groupOwner("3"), concurrent: true, groupId: "3", unit: "sas", investigation: "1"
        }),
        user: groupedStudent
      })).toBe(true);
    });

    it("does not treat a document model's groupId as evidence of group ownership", () => {
      // A `groupId` on the model does not make a document group-owned — only the owner uid does, via
      // hasGroupOwner reading its prefix. So a group number matching the user's own must not grant an
      // edit by itself.
      const authoredByAGroupmate = createDocumentModel({
        uid: "someone-else", type: ProblemDocument, key: "k", concurrent: true,
        groupId: "3", unit: "sas", investigation: "1"
      });
      expect(authoredByAGroupmate.groupId).toBe("3");
      expect(canUserEditDocument({ document: authoredByAGroupmate, user: groupedStudent })).toBe(false);
    });

    it("allows a user to edit their own document via the document-only path (no metadata)", () => {
      const ownDocument = createDocumentModel({ uid: "me", type: ProblemDocument, key: "k" });
      expect(canUserEditDocument({ document: ownDocument, user: student })).toBe(true);
    });

    it("allows any member of the class to edit a class-wide document via the document-only path" +
       " (no metadata)", () => {
      const classWideDocument = createDocumentModel({
        uid: "someone-else", type: GroupDocument, key: "k", concurrent: true,
        unit: "sas", contextId: "class-1"
      });
      expect(canUserEditDocument({ document: classWideDocument, user: student })).toBe(true);
    });

    it("allows a group member to edit their group's document via the document-only path (no metadata)", () => {
      const groupDocument = createDocumentModel({
        uid: groupOwner("3"), type: GroupDocument, key: "k", concurrent: true,
        unit: "sas", investigation: "1", offeringId: kOffering
      });
      expect(canUserEditDocument({ document: groupDocument, user: groupedStudent })).toBe(true);
    });
  });
});

describe("isDocumentAccessibleToUser — group documents", () => {
  const student: any = { id: "s1", isTeacherOrResearcher: false, isStudent: true };
  const documents: any = { isExemplarVisible: () => false };

  it("grants a student access to a group-typed doc owned by someone else, with or without concurrent", () => {
    // Access is keyed on the document TYPE (a permission tied to kind), not the stored `concurrent`
    // field, so a pre-existing group doc lacking `concurrent` is still class-wide readable.
    const groupNoFlag: any = { uid: "other", type: GroupDocument, key: "g1" };  // no concurrent
    expect(isDocumentAccessibleToUser({ documentMetadata: groupNoFlag, documents, user: student })).toBe(true);

    const groupWithFlag: any = { uid: "other", type: GroupDocument, key: "g2", concurrent: true };
    expect(isDocumentAccessibleToUser({ documentMetadata: groupWithFlag, documents, user: student })).toBe(true);
  });

  it("denies a student access to a non-shared personal document owned by someone else", () => {
    const documentMetadata: any = { uid: "other", type: "personal", key: "p1" };
    expect(isDocumentAccessibleToUser({ documentMetadata, documents, user: student })).toBe(false);
  });
});
