import { UnitModel } from "../curriculum/unit";
import { AppConfigModel } from "../stores/app-config-model";
import { DocumentMetadataModel } from "../document/document-metadata-model";
import { PersonalDocument, ProblemDocument, SupportPublication } from "./document-types";
import { getDocumentDisplayTitle } from "./document-utils";
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
        expect(title).toMatch(/Test Title \(23FEB76-..:..:..\)/);
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
  });
});
