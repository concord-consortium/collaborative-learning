import { DBListeners } from ".";
import { DocumentModel } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { DocumentsModel } from "../../models/stores/documents";
import { specAppConfig } from "../../models/stores/spec-app-config";
import { createStores } from "../../models/stores/stores";
import { UserModel } from "../../models/stores/user";
import { DB, Monitor } from "../db";

describe("DBListeners", () => {
  const stores = createStores({
    appConfig: specAppConfig(),
    appMode: "test",
    documents: DocumentsModel.create(),
    user: UserModel.create({id: "1", portal: "example.com"})
  });
  const db = new DB();
  const document = DocumentModel.create({
                    uid: "1", type: ProblemDocument, key: "doc-1", content: {} });

  beforeEach(async () => {
    await db.connect({appMode: "test", stores, dontStartListeners: true});
  });

  afterEach(() => {
    db.disconnect();
  });

  it("warns when monitoring the same document multiple times", () => {
    const listeners = new DBListeners(db);
    expect(listeners).toBeDefined();

    listeners.monitorDocument(document, Monitor.Local);
    jestSpyConsole("warn", mockConsole => {
      listeners.monitorDocument(document, Monitor.Local);
      expect(mockConsole).toHaveBeenCalledTimes(1);
    });
  });
});
