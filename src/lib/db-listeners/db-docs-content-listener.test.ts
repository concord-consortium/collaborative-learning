import { IObservableArray, observable, runInAction } from "mobx";
import { LearningLogDocument, PersonalDocument } from "../../models/document/document-types";
import { DBDocumentsContentListener } from "./db-docs-content-listener";

describe("DBDocumentsContentListener (personal documents)", () => {
  const documentPath = (uid: string, key: string) => `users/${uid}/documents/${key}`;

  let docs: IObservableArray;
  let problemWorkspace: { primaryDocumentKey?: string; comparisonDocumentKey?: string };
  let user: { id: string; isTeacher: boolean; currentGroupId?: string };
  let refsByPath: Record<string, { on: jest.Mock; off: jest.Mock; toString: () => string }>;
  let handlersByPath: Record<string, (snapshot: { val: () => any }) => void>;
  let db: any;

  const makeDoc = (key: string, uid: string, type: string = PersonalDocument) =>
    ({ key, uid, type, setGroupId: jest.fn(), setContent: jest.fn() });

  const makeRef = (path: string) => {
    if (!refsByPath[path]) {
      refsByPath[path] = {
        on: jest.fn((_event: string, cb: (snapshot: { val: () => any }) => void) => {
          handlersByPath[path] = cb;
        }),
        off: jest.fn(() => { delete handlersByPath[path]; }),
        toString: () => path
      };
    }
    return refsByPath[path];
  };

  beforeEach(() => {
    docs = observable.array([], { deep: false });
    problemWorkspace = observable({ primaryDocumentKey: undefined, comparisonDocumentKey: undefined });
    user = observable({ id: "teacher-1", isTeacher: true, currentGroupId: undefined });
    refsByPath = {};
    handlersByPath = {};

    db = {
      stores: {
        documents: { byType: (type: string) => docs.filter((d: any) => d.type === type) },
        groups: { groupIdForUser: jest.fn(() => undefined) },
        persistentUI: { problemWorkspace },
        user
      },
      firebase: {
        ref: jest.fn((path: string) => makeRef(path)),
        getUserDocumentPath: (_u: any, key: string, uid: string) => documentPath(uid, key)
      },
      parseDocumentContent: jest.fn((dbDoc: any) => dbDoc.content)
    };
  });

  it("attaches a content listener for a personal document", () => {
    const listener = new DBDocumentsContentListener(db);
    listener.start();

    const doc = makeDoc("p1", "student-1");
    runInAction(() => docs.push(doc));

    const path = documentPath("student-1", "p1");
    expect(db.firebase.ref).toHaveBeenCalledWith(path);
    expect(refsByPath[path].on).toHaveBeenCalledWith("value", expect.any(Function));

    listener.stop();
  });

  it("updates the document's content when a remote snapshot arrives", () => {
    const listener = new DBDocumentsContentListener(db);
    listener.start();

    const doc = makeDoc("p1", "student-1");
    runInAction(() => docs.push(doc));

    const path = documentPath("student-1", "p1");
    handlersByPath[path]({ val: () => ({ content: { rowMap: { r1: {} } } }) });

    expect(db.parseDocumentContent).toHaveBeenCalledWith({ content: { rowMap: { r1: {} } } });
    expect(doc.setContent).toHaveBeenCalledWith({ rowMap: { r1: {} } });

    listener.stop();
  });

  it("monitors the user's own personal documents (unlike problem documents)", () => {
    const listener = new DBDocumentsContentListener(db);
    listener.start();

    // owned by the current user
    const ownDoc = makeDoc("own", "teacher-1");
    runInAction(() => docs.push(ownDoc));

    expect(refsByPath[documentPath("teacher-1", "own")]?.on).toHaveBeenCalled();

    listener.stop();
  });

  it("monitors learning log documents", () => {
    const listener = new DBDocumentsContentListener(db);
    listener.start();

    const doc = makeDoc("ll1", "student-1", LearningLogDocument);
    runInAction(() => docs.push(doc));

    const path = documentPath("student-1", "ll1");
    expect(refsByPath[path]?.on).toHaveBeenCalledWith("value", expect.any(Function));

    listener.stop();
  });

  it("monitors personal documents owned by other users (teacher viewing student work)", () => {
    const listener = new DBDocumentsContentListener(db);
    listener.start();

    const docA = makeDoc("pa", "student-1");
    const docB = makeDoc("pb", "student-2");
    runInAction(() => { docs.push(docA); docs.push(docB); });

    expect(refsByPath[documentPath("student-1", "pa")]?.on).toHaveBeenCalled();
    expect(refsByPath[documentPath("student-2", "pb")]?.on).toHaveBeenCalled();

    listener.stop();
  });

  it("does not monitor the document open for editing, and re-monitors when it closes", () => {
    const listener = new DBDocumentsContentListener(db);
    listener.start();

    const doc = makeDoc("p1", "student-1");
    runInAction(() => docs.push(doc));

    const path = documentPath("student-1", "p1");
    expect(refsByPath[path].on).toHaveBeenCalledTimes(1);

    // Opening the doc for editing in the workspace should tear down its monitor
    // so a remote snapshot can't clobber local unsaved edits.
    runInAction(() => { problemWorkspace.primaryDocumentKey = "p1"; });
    expect(refsByPath[path].off).toHaveBeenCalledWith("value", expect.any(Function));

    // Closing the editor re-attaches the monitor.
    runInAction(() => { problemWorkspace.primaryDocumentKey = undefined; });
    expect(refsByPath[path].on).toHaveBeenCalledTimes(2);

    listener.stop();
  });

  it("does not monitor the comparison document open for editing", () => {
    const listener = new DBDocumentsContentListener(db);
    listener.start();

    const doc = makeDoc("p1", "student-1");
    runInAction(() => { problemWorkspace.comparisonDocumentKey = "p1"; });
    runInAction(() => docs.push(doc));

    const path = documentPath("student-1", "p1");
    expect(refsByPath[path]).toBeUndefined();

    listener.stop();
  });

  it("removes all monitors on stop", () => {
    const listener = new DBDocumentsContentListener(db);
    listener.start();

    const doc = makeDoc("p1", "student-1");
    runInAction(() => docs.push(doc));
    const path = documentPath("student-1", "p1");

    listener.stop();

    expect(refsByPath[path].off).toHaveBeenCalledWith("value", expect.any(Function));
  });
});
