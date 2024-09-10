import { makeAutoObservable, runInAction } from "mobx";
import { chunk } from "lodash";
import { Firestore } from "../lib/firestore";
import { ClassDocument, CurriculumDocument, DocumentDocument } from "../lib/firestore-schema";
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

export interface UserDocumentInfo {
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
  userDocs: UserDocumentInfo[] = [];

  constructor(
      db: Firestore,
      unit: string,
      problem: string) {
    makeAutoObservable(this);
    this.db = db;
    this.unit = unit;
    this.problem = problem;
  }

  async setUser(user: UserModelType) {
    this.user = user;
    return Promise.all([
      this.queryCurriculumDocs(),
      this.queryUserDocs()]);
  }

  private async queryCurriculumDocs() {
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
    runInAction(() => {
      this.curriculumDocs = commentedDocs;
    });
  }

  private async queryUserDocs() {
    // Find teacher's classes
    const classesRef = this.db.collection("classes");
    const individualClasses = (await classesRef.where("teachers", "array-contains", this.user.id).get()).docs;
    const networkClasses = this.user.network
      ? (await classesRef.where("networks", "array-contains", this.user.network).get()).docs
      : [];
    const allClasses = individualClasses.concat(networkClasses);
    const classIds = new Set<string>();
    allClasses.forEach(doc => {
      classIds.add((doc.data() as ClassDocument).context_id);
    });

    // Find student documents
    if (classIds.size === 0) {
      return;
    }
    const collection = this.db.collection("documents");
    // Firestore has a limit of ~10 for "in" queries (30 in recent versions), so we need to iterate over the classes
    const chunkSize = 10;
    const teacherClassGroups = chunk([...classIds], chunkSize);
    const studentDocs: UserDocumentInfo[] = [];
    for (const group of teacherClassGroups) {
      const docsQuery = collection.where("context_id", "in", group);
      const result = await docsQuery.get();
      for (const doc of result.docs) {
        const data = doc.data() as DocumentDocument;
        studentDocs.push({
          id: doc.id,
          title: "temp",
          numComments: 0,
          ...data
        });
      }
    }
    const commentedDocs: UserDocumentInfo[] = [];
    const promiseArr: Promise<void>[] = [];
    // TODO maybe combine multiple "docs" that have same ID?
    for (const doc of studentDocs){
      const docCommentsRef = collection.doc(doc.id).collection("comments");
      // NOTE, Firestore v10 supports `.count()` queries so we wouldn't have to fetch the entire collection
      promiseArr.push(docCommentsRef.get().then((qs)=>{
        if (qs.empty === false){
          const commentedDoc = {...doc, numComments: qs.size};
          commentedDocs.push(commentedDoc);
        }
      }));
    }
    await Promise.all(promiseArr);
    runInAction(() => {
      this.userDocs = commentedDocs;
    });
  }

}
