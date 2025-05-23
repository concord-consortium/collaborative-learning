import { DBListeners } from ".";
import { DocumentsModel } from "../../models/stores/documents";
import { specAppConfig } from "../../models/stores/spec-app-config";
import { createStores } from "../../models/stores/stores";
import { UserModel } from "../../models/stores/user";
import { DB } from "../db";

// For some reason the DB connect is running slowly
jest.setTimeout(15000);

describe("DBListeners", () => {
  const stores = createStores({
    appConfig: specAppConfig(),
    appMode: "test",
    documents: DocumentsModel.create(),
    user: UserModel.create({id: "1", portal: "example.com"})
  });
  const db = new DB();

  beforeEach(async () => {
    // NOTE: for better or worse this is actually connecting to Firebase for real
    // in other tests the Firebase library is mocked.
    await db.connect({appMode: "test", stores, dontStartListeners: true, authPersistence: "none"});
  });

  afterEach(() => {
    db.disconnect();
  });

  it("can create all of the listeners", () => {
    const listeners = new DBListeners(db);
    expect(listeners.isListening).toBeFalsy();
  });

  // TODO: add more tests of these listeners
});
