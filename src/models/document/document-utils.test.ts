import { UnitModel } from "../curriculum/unit";
import { AppConfigModel } from "../stores/app-config-model";
import { DocumentMetadataModel } from "../document/document-metadata-model";
import { UserModel } from "../stores/user";
import { createDocumentModel } from "./document";
import { GroupDocument, PersonalDocument, ProblemDocument, SupportPublication } from "./document-types";
import { canUserEditDocument, getDocumentDisplayTitle, isDocumentAccessibleToUser } from "./document-utils";
import { registerDocumentKind } from "./document-kinds";
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

      test("a class-wide document uses its kind's registered title (resolved by kind, not stored)", () => {
        registerDocumentKind("testClassWideTitle", {
          metadataFields: { concurrent: true }, ownerType: "class", scopeType: "classUnit",
          title: "Driving Question Board"
        });
        const metadata = DocumentMetadataModel.create({
          // type stays "group"; the title comes from the kind, and no `title` is stored on the doc.
          type: GroupDocument, kind: "testClassWideTitle", uid: "class_c1", key: "dqb-1"
        });
        expect(getDocumentDisplayTitle(unit, metadata, appConfig)).toBe("Driving Question Board");
      });
    });
  });

  describe("canUserEditDocument", () => {
    const student = UserModel.create({ id: "me", type: "student", name: "Me", classHash: "class-1" });
    const groupedStudent = UserModel.create({
      id: "me", type: "student", name: "Me", classHash: "class-1", currentGroupId: "3"
    });

    const metadata = (props: Record<string, any>) =>
      DocumentMetadataModel.create({ uid: "someone-else", type: GroupDocument, key: "k", ...props });

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
        documentMetadata: metadata({ concurrent: true, groupId: "3", unit: "sas", investigation: "1" }),
        user: groupedStudent
      })).toBe(true);
    });

    it("refuses another group's document", () => {
      expect(canUserEditDocument({
        documentMetadata: metadata({ concurrent: true, groupId: "7", unit: "sas", investigation: "1" }),
        user: groupedStudent
      })).toBe(false);
    });

    it("refuses a group document when the user is not in a group", () => {
      expect(canUserEditDocument({
        documentMetadata: metadata({ concurrent: true, groupId: "3", unit: "sas", investigation: "1" }),
        user: student
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

    it("refuses a document that is not concurrent even inside the user's own scope", () => {
      expect(canUserEditDocument({
        documentMetadata: metadata({ unit: "sas", investigation: null, context_id: "class-1" }),
        user: student
      })).toBe(false);
    });

    it("returns false when neither a document nor metadata is supplied", () => {
      expect(canUserEditDocument({ user: student })).toBe(false);
    });

    it("prefers the reactive metadata's group id over a still-loading document", () => {
      // A groupmate's document syncs into the metadata before its content finishes loading; reading
      // the metadata per field is what makes the Edit button appear without a reload.
      const stillLoading = createDocumentModel({
        uid: "someone-else", type: GroupDocument, key: "k", concurrent: true
      });
      expect(stillLoading.groupId).toBeUndefined();
      expect(canUserEditDocument({
        document: stillLoading,
        documentMetadata: metadata({ concurrent: true, groupId: "3", unit: "sas", investigation: "1" }),
        user: groupedStudent
      })).toBe(true);
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
