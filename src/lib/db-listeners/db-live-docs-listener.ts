import firebase from "firebase/app";
import { DB } from "../db";
import { BaseListener } from "./base-listener";
import { DocumentsModelType } from "../../models/stores/documents";
import { ProblemDocument, PersonalDocument } from "../../models/document/document-types";

export class DBLiveDocsListener extends BaseListener {
  private db: DB;
  private documentsModel: DocumentsModelType;
  private classUsersRef: firebase.database.Reference | null = null;

  constructor(db: DB) {
    super("DBLiveDocsListener");
    this.db = db;
  }

  public start() {

    const { user } = this.db.stores;
    console.log("\t🥩 user:", user);
    const usersPath = this.db.firebase.getUsersPath(user);
    console.log("\t🥩 usersPath:", usersPath);
    this.classUsersRef = this.db.firebase.ref(usersPath);

    this.classUsersRef.on("child_added", this.processDocuments);
    // this.classUsersRef.on("child_changed", this.processDocuments);
  }

  public stop() {
    if (this.classUsersRef) {
      this.classUsersRef.off("child_added", this.processDocuments);
      this.classUsersRef.off("child_changed", this.processDocuments);
    }
  }

  //adds firebase snapshot -> local model
  private processDocuments = (snapshot: firebase.database.DataSnapshot) => {
    console.log("\t🥩 snapshot Ref", snapshot.ref);
    console.log("\t🥩 snapshot:", snapshot.val());
    //

  };


  private filterAllDocuments = () => {
    const nonPublishedPersonalDocs = this.documentsModel.byType(PersonalDocument)
        .filter((doc: any ) => !doc.isPublished);
    console.log("\t🥩 nonPublishedPersonalDocs:", nonPublishedPersonalDocs);
    const nonPublishedProblemDocs = this.documentsModel.byType(ProblemDocument)
        .filter((doc: any) => !doc.isPublished);
    console.log("\t🥩 nonPublishedProblemDocs:", nonPublishedProblemDocs);


    // nonPublishedPersonalDocs.forEach(this.handleDocument);
    // nonPublishedProblemDocs.forEach(this.handleDocument);
  };

  private handleDocument = (document: typeof PersonalDocument | typeof ProblemDocument) => {
    console.log(`Handling document:`, document);
  };
}

// Usage example:
// const db = new DB();
// const documentsModel = createDocumentsModelWithRequiredDocuments(['problem', 'personal']);
// const liveDocsListener = new DBLiveDocsListener(db, documentsModel);
// liveDocsListener.start();

