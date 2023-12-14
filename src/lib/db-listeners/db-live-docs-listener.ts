import { DB } from "../db";
import { BaseListener } from "./base-listener";

export class DBLiveDocsListener extends BaseListener {
  private db: DB;
  constructor(db: DB) {
    super("DBProblemDocumentsListener"); // is this the parent class we want?
    this.db = db;
  }
}

