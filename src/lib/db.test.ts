import { DB } from "./db";
import { IStores, createStores } from "../models/stores";
import { UserModel } from "../models/user";
import { DBDocument } from "./db-types";
import { DocumentContentModel } from "../models/document-content";
import { TextContentModelType } from "../models/tools/text/text-content";
import { createSingleTileContent } from "../utilities/test-utils";
import { ToolTileModelType } from "../models/tools/tool-tile";

describe("db", () => {
  let stores: IStores;

  beforeEach(() => {
    stores = createStores({
      user: UserModel.create({id: "1", portal: "example.com"}),
      appMode: "test",
    });
  });

  it("connects", () => {
    const db = new DB();
    return db.connect({appMode: "test", stores})
      .then(() => {
        expect(db.firebase.isConnected).toBe(true);
      })
      .then(() => db.disconnect());
  }, 10000);

  it("resolves paths in test mode", () => {
    const db = new DB();
    return db.connect({appMode: "test", stores})
      .then(() => {
        expect(db.firebase.getRootFolder()).toMatch(/^\/test\/([^/])+\/portals\/example_com\/$/);
        expect(db.firebase.getFullPath("foo")).toMatch(/^\/test\/([^/])+\/portals\/example_com\/foo$/);
      })
      .then(() => db.disconnect());
  });

  it("resolves paths in dev mode", () => {
    const db = new DB();
    stores.appMode = "dev";
    return db.connect({appMode: "dev", stores})
      .then(() => {
        expect(db.firebase.getRootFolder()).toMatch(/^\/dev\/([^/])+\/portals\/example_com\/$/);
        expect(db.firebase.getFullPath("foo")).toMatch(/^\/dev\/([^/])+\/portals\/example_com\/foo$/);
      })
      .then(() => db.disconnect());
  });

  it("can get a reference to the database", () => {
    const db = new DB();
    return db.connect({appMode: "test", stores})
      .then(() => {
        const testString = "this is a test!";
        const ref = db.firebase.ref("write-test");
        return ref.set(testString)
          .then(() => {
            return ref.once("value", (snapshot) => {
              expect(snapshot.val()).toBe(testString);
            });
          });
        })
      .then(() => db.disconnect());
  });

  it("can parse document text content", () => {
    const db = new DB();
    // tslint:disable-next-line:max-line-length
    const storedJsonString = JSON.stringify(createSingleTileContent({ type: "Text", text: "Testing" }));
    const docContentSnapshot = db.parseDocumentContent({content: storedJsonString} as DBDocument);
    const docContent = DocumentContentModel.create(docContentSnapshot);

    if (docContent == null) {
      fail();
      return;
    }

    expect(docContent.tileMap!.size).toBe(1);
    docContent.tileMap!.forEach((tile: ToolTileModelType) => {
      const tileContent = tile.content as TextContentModelType;
      expect(tileContent.type).toBe("Text");
      expect(tileContent.format).toBeUndefined();
      expect(tileContent.text).toBe("Testing");
    });
  });

});
