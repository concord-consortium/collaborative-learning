import { DB } from "./db";
import { IStores, createStores } from "../models/stores";
import { UserModel } from "../models/user";
import { DBDocument } from "./db-types";
import { TextContentModelType } from "../models/tools/text/text-content";

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
    const storedJsonString = "{\"tiles\":[{\"id\":\"9d1cfc99-121a-4817-bc08-2144d00ba6d0\",\"content\":{\"type\":\"Text\",\"text\":\"{\\\"object\\\":\\\"value\\\",\\\"document\\\":{\\\"object\\\":\\\"document\\\",\\\"data\\\":{},\\\"nodes\\\":[{\\\"object\\\":\\\"block\\\",\\\"type\\\":\\\"line\\\",\\\"data\\\":{},\\\"nodes\\\":[{\\\"object\\\":\\\"text\\\",\\\"leaves\\\":[{\\\"object\\\":\\\"leaf\\\",\\\"text\\\":\\\"laaa\\\",\\\"marks\\\":[]}]}]}]}}\"}},{\"id\":\"72c8d88f-edea-4ac4-a7e7-0d70ecf960c0\",\"content\":{\"type\":\"Text\",\"text\":\"{\\\"object\\\":\\\"value\\\",\\\"document\\\":{\\\"object\\\":\\\"document\\\",\\\"data\\\":{},\\\"nodes\\\":[{\\\"object\\\":\\\"block\\\",\\\"type\\\":\\\"line\\\",\\\"data\\\":{},\\\"nodes\\\":[{\\\"object\\\":\\\"text\\\",\\\"leaves\\\":[{\\\"object\\\":\\\"leaf\\\",\\\"text\\\":\\\"Testing\\\",\\\"marks\\\":[]}]}]}]}}\",\"format\":\"slate\"}}]}";
    const docContent = db.parseDocumentContent({content: storedJsonString} as DBDocument);

    if (docContent == null) {
      fail();
      return;
    }

    expect(docContent.tiles.length).toBe(2);
    const tileContent = docContent.tiles[1].content as TextContentModelType;
    expect(tileContent.type).toBe("Text");
    expect(tileContent.format).toBe("slate");
    expect(tileContent.getSlate().texts.get(0).getText()).toBe("Testing");
  });

});
