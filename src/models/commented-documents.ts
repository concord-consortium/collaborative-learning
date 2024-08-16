import { makeAutoObservable } from "mobx";
import { Firestore } from "../lib/firestore";
import { CurriculumDocument, DocumentDocument } from "../lib/firestore-schema";
import { getSectionTitle } from "./curriculum/section";
import { UserModelType } from "./stores/user";

export interface CurriculumDocumentInfo {
  id: string;
  unit: string;
  problem: string;
  path: string;
  title: string;
  numComments: number;
}

export interface StudentDocumentInfo {
  id: string;
  key: string;
  title: string;
  numComments: number;
}

export class CommentedDocumentsQuery {
  db: Firestore;
  user: UserModelType;
  unit: string;
  problem: string;

  curriculumDocs: CurriculumDocumentInfo[] = [];
  studentDocs: StudentDocumentInfo[] = [];

  constructor(
      db: Firestore,
      user: UserModelType,
      unit: string,
      problem: string) {
    makeAutoObservable(this);
    this.db = db;
    this.user = user;
    this.unit = unit;
    this.problem = problem;
  }

  getCurricumDocs(): CurriculumDocumentInfo[] {
    return this.curriculumDocs;
  }

  getStudentDocs(): StudentDocumentInfo[] {
    return this.studentDocs;
  }

  async queryCurriculumDocs() {
    const cDocsRef = this.db.collection("curriculum");
    let docsQuery;
    if (this.user.network){
      docsQuery = cDocsRef
      .where("unit", "==", this.unit)
      .where("problem", "==", this.problem)
      .where("network","==", this.user.network);
    } else {
      docsQuery = cDocsRef
      .where("unit", "==", this.unit)
      .where("problem", "==", this.problem)
      //for teachers not in network, look for documents matching the uid
      .where ("uid", "==", this.user.id);
    }
    const result = await docsQuery.get();
    const docs: CurriculumDocumentInfo[] = result.docs.map(doc => {
      return {
        id: doc.id,
        title: "temp",
        numComments: 0,
        ...doc.data() as CurriculumDocument
      };
    });
    const commentedDocs: CurriculumDocumentInfo[] = [];
    const promiseArr: Promise<void>[] = [];
    for (let doc of docs) {
      const docCommentsRef = cDocsRef.doc(doc.id).collection("comments");
      promiseArr.push(docCommentsRef.get().then((qs) => {
        if (qs.empty === false) {
          const firstCharPosition = doc.id.split("_", 4).join("_").length + 1; //first char after 4th _
          const sectionType = doc.id.substring(firstCharPosition, doc.id.length);
          doc = { ...doc, title: getSectionTitle(sectionType), numComments: qs.size };
          commentedDocs.push(doc);
        }
      }));
    }
    await Promise.all(promiseArr);
    this.curriculumDocs = commentedDocs;
  }

// classes = db.collection("classes").where("teachers", "array-contains", user.id) OR db.collection("classes").where("network", "==", user.network);
// where "context_id" is in classes.  Iterate over classes because there's a limit of ~10 for "in" queries.


  async queryStudentDocs() {
    console.log("running queryStudentDocs");
    const collection = this.db.collection("documents");
    let docsQuery;
    if(this.user.network){
      docsQuery = collection.where("network", "==", this.user.network);
    } else {
      docsQuery = collection.where("uid", "==", this.user.id);
    }
    const result = await docsQuery.get();
    console.log('query result:', result.docs.length);
    const docs: StudentDocumentInfo[] = result.docs.map(doc => {
      const data = doc.data() as DocumentDocument;
      return {
        id: doc.id,
        numComments: 0,
        title: "temp",
        ...data
      };
    });
    const commentedDocs: StudentDocumentInfo[] = [];
    const promiseArr: Promise<void>[] = [];
    // TODO maybe combine multiple "docs" that have same ID?
    for (let doc of docs){
      const docCommentsRef = collection.doc(doc.id).collection("comments");
      promiseArr.push(docCommentsRef.get().then((qs)=>{
        console.log('comments:', docCommentsRef.path, qs.size);
        if (qs.empty === false){
          doc = {...doc, numComments: qs.size};
          commentedDocs.push(doc);
        }
      }));
    }
    await Promise.all(promiseArr);
    this.studentDocs = commentedDocs;
    console.log('stored studentDocs:', this.studentDocs);
  }

}
