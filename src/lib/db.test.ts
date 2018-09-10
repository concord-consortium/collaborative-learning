import { DB } from "./db";
import { IStores, createStores } from "../models/stores";

describe("db", () => {
  let stores: IStores;

  beforeEach(() => {
    stores = createStores();
  });

  it("connects", () => {
    const db = new DB();
    return db.connect({appMode: "test", stores})
      .then(() => {
        expect(db.isConnected).toBe(true);
      })
      .then(() => db.disconnect());
  });

  it("resolves paths in test mode", () => {
    const db = new DB();
    return db.connect({appMode: "test", stores})
      .then(() => {
        expect(db.getRootFolder()).toMatch(/^\/test\/([^/])+\/$/);
        expect(db.getFullPath("foo")).toMatch(/^\/test\/([^/])+\/foo$/);
      })
      .then(() => db.disconnect());
  });

  it("resolves paths in dev mode", () => {
    const db = new DB();
    return db.connect({appMode: "dev", stores})
      .then(() => {
        expect(db.getRootFolder()).toMatch(/^\/dev\/([^/])+\/$/);
        expect(db.getFullPath("foo")).toMatch(/^\/dev\/([^/])+\/foo$/);
      })
      .then(() => db.disconnect());
  });

  it("can get a reference to the database", () => {
    const db = new DB();
    return db.connect({appMode: "test", stores})
      .then(() => {
        const testString = "this is a test!";
        const ref = db.ref("write-test");
        return ref.set(testString)
          .then(() => {
            return ref.once("value", (snapshot) => {
              expect(snapshot.val()).toBe(testString);
            });
          });
        })
      .then(() => db.disconnect());
  });

});
