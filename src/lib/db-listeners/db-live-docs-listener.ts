import { DB } from "../db";
import { BaseListener } from "./base-listener";

/*
   This would be a separate listener entirely, but it seems like it would
   have a lot of overlap with existing listeners?  So trying an approach
   of first making a personal-documents-listener.ts ... in other file, but
   leaving this stub here for now.
*/
export class DBLiveDocsListener extends BaseListener {
  private db: DB;
  constructor(db: DB) {
    super("DBLiveDocumentsListener");
    this.db = db;
  }
}

