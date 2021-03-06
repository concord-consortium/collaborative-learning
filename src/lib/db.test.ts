import { DB } from "./db";
import { IStores, createStores } from "../models/stores/stores";
import { UserModel } from "../models/stores/user";
import { DBDocument } from "./db-types";
import { DocumentContentModel } from "../models/document/document-content";
import { TextContentModelType } from "../models/tools/text/text-content";
import { createSingleTileContent } from "../utilities/test-utils";
import { ToolTileModelType } from "../models/tools/tool-tile";

describe("db", () => {
  let stores: IStores;
  let db: DB;

  beforeEach(() => {
    stores = createStores({
      user: UserModel.create({id: "1", portal: "example.com"}),
      appMode: "test",
    });
    db = new DB();
  });

  afterEach(() => {
    // delete all test data (for this unique anonymous test user)
    db.firebase.ref().remove();
    db.disconnect();
  });

  it("connects/disconnects", async () => {
    expect.assertions(5);
    expect(db.firebase.isConnected).toBe(false);
    expect(db.isAuthStateSubscribed()).toBe(false);
    await db.connect({appMode: "test", stores, dontStartListeners: true});
    expect(db.firebase.isConnected).toBe(true);
    expect(db.isAuthStateSubscribed()).toBe(true);
    db.disconnect();
    expect(db.isAuthStateSubscribed()).toBe(false);
}, 5000);

  it("resolves paths in test mode", async () => {
    expect.assertions(2);
    await db.connect({appMode: "test", stores, dontStartListeners: true});
    expect(db.firebase.getRootFolder()).toMatch(/^\/test\/([^/])+\/portals\/example_com\/$/);
    expect(db.firebase.getFullPath("foo")).toMatch(/^\/test\/([^/])+\/portals\/example_com\/foo$/);
  });

  it("resolves paths in dev mode", async () => {
    expect.assertions(2);
    stores.appMode = "dev";
    await db.connect({appMode: "dev", stores, dontStartListeners: true});
    expect(db.firebase.getRootFolder()).toMatch(/^\/dev\/([^/])+\/portals\/example_com\/$/);
    expect(db.firebase.getFullPath("foo")).toMatch(/^\/dev\/([^/])+\/portals\/example_com\/foo$/);
  });

  it("can get a reference to the database", async () => {
    expect.assertions(1);
    await db.connect({appMode: "test", stores, dontStartListeners: true});
    const testString = "this is a test";
    const ref = db.firebase.ref("write-test");
    ref.set(testString);
    const snapshot = await ref.once("value");
    expect(snapshot.val()).toBe(testString);
  });

  it("can parse document text content", async () => {
    expect.assertions(4);
    await db.connect({appMode: "test", stores, dontStartListeners: true});
    const storedJsonString = JSON.stringify(createSingleTileContent({ type: "Text", text: "Testing" }));
    const docContentSnapshot = db.parseDocumentContent({content: storedJsonString} as DBDocument);
    const docContent = DocumentContentModel.create(docContentSnapshot);

    if (docContent == null) {
      fail();
      return;
    }

    expect(docContent.tileMap.size).toBe(1);
    docContent.tileMap.forEach((tile: ToolTileModelType) => {
      const tileContent = tile.content as TextContentModelType;
      expect(tileContent.type).toBe("Text");
      expect(tileContent.format).toBeUndefined();
      expect(tileContent.text).toBe("Testing");
    });
  });

});
