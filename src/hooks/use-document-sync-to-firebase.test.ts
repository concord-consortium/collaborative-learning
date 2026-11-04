import { renderHook, waitFor } from "@testing-library/react";
import { observable, reaction, runInAction } from "mobx";
import { SnapshotIn } from "mobx-state-tree";
import { UseMutationOptions } from "react-query";
import firebase from "firebase/app";
import { Firebase } from "../lib/firebase";
import { Firestore } from "../lib/firestore";
import * as senderModule from "../models/document/content-save-sender";
import { ContentSaveSender } from "../models/document/content-save-sender";
import { DocumentModel, createDocumentModel } from "../models/document/document";
import {
  LearningLogDocument, PersonalDocument, PlanningDocument, ProblemDocument, ProblemPublication
} from "../models/document/document-types";
import * as logDocumentEventModule from "../models/document/log-document-event";
import { ICommitListener, ICommitSource, ICommittedEntry } from "../models/history/history-commits";
import { IHistoryManager, TreeManagerType } from "../models/history/tree-manager";
import { LogEventName } from "../lib/logger-types";
import { UserModel, UserModelType } from "../models/stores/user";
import { useDocumentSyncToFirebase } from "./use-document-sync-to-firebase";
const libDebug = require("../lib/debug");

import "../models/tiles/text/text-registration";

const mockUseMutation = jest.fn((callback: (vars: any) => Promise<any>, options?: UseMutationOptions) => {
  return {
    mutate: (vars: any) => {
      const context = options?.onMutate?.(vars) ?? {};
      callback(vars)
        .then(data => { options?.onSuccess?.(data, vars, context); })
        .catch(err => {
          options?.onError?.(err, vars, context);
          if (((typeof options?.retry === "boolean") && options.retry) ||
              ((typeof options?.retry === "function") && options.retry(1, "error"))) {
            const delay = ((typeof options?.retryDelay === "number") && options.retryDelay) ||
                          ((typeof options?.retryDelay === "function") && options.retryDelay(1, "error"));
            // make it async, but minimal delay for testing purposes
            setTimeout(() => {
              try {
                callback(vars);
              }
              catch {
                // ignore any errors on retry
              }
            }, delay || 0);
          }
        });
    }
  };
});
jest.mock("react-query", () => ({
  useMutation: (callback: (vars: any) => Promise<any>, options?: any) => mockUseMutation(callback, options)
}));

const mockFirestoreDocUpdate = jest.fn();
const mockCreateFirestoreMetadataDocument_v2 = jest.fn();
const mockPostDocumentComment_v2 = jest.fn();
const mockHttpsCallable = jest.fn((fn: string) => {
  switch(fn) {
    case "createFirestoreMetadataDocument_v2":
      return mockCreateFirestoreMetadataDocument_v2;
    case "postDocumentComment_v2":
      return mockPostDocumentComment_v2;
  }
});


jest.mock("firebase/app", () => {
  // Queries can have where clauses chained off of them
  const mockQuery = jest.fn();
  mockQuery.mockReturnValue({
    get: jest.fn().mockResolvedValue({
      docs: [{ ref: { update: (value: unknown) => mockFirestoreDocUpdate(value) } }]
    }),
    where: mockQuery
  });

  const mockFirestore = jest.fn().mockReturnValue({
    collection: mockQuery
  });
  return {
    firestore: mockFirestore,
    functions: () => ({
      httpsCallable: (fn: string) => mockHttpsCallable(fn)
    }),
  };
});

const mockUpdate = jest.fn();
const mockRef = jest.fn();
const mockSetLastEditedOnDisconnect = jest.fn();
const mockSetLastEditedNow = jest.fn();
const mockOnlineStatusListenerOn = jest.fn();
const mockOnlineStatusListenerOff = jest.fn();
const mockOnlineStatusRef = {
  on: mockOnlineStatusListenerOn,
  off: mockOnlineStatusListenerOff
};

const specUser = (overrides?: Partial<SnapshotIn<typeof UserModel>>) => {
  return UserModel.create({ id: "1", ...overrides });
};

const specFirebase = (type: string, key: string) => {
  return {
    getDocumentPaths: (user: UserModelType) => {
      return {
        content: `${user.id}/content/${key}`,
        metadata: `${user.id}/metadata/${key}`,
        typedMetadata: `${user.id}/${type}/${key}`
      };
    },
    ref: (path: string) => mockRef(path),
    setLastEditedOnDisconnect: mockSetLastEditedOnDisconnect,
    setLastEditedNow: mockSetLastEditedNow,
    onlineStatusRef: mockOnlineStatusRef,
  } as unknown as Firebase;
};

// Reports commits only when a test says so.
class StubCommitSource implements IHistoryManager, ICommitSource {
  lastCommitted: ICommittedEntry | undefined = undefined;
  private listeners = new Set<ICommitListener>();
  private nextIndex = 1;

  onHistoryEntryCompleted() {
    // entries commit only when a test calls commit
  }

  addCommitListener(listener: ICommitListener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  commit(...ids: string[]) {
    const entries = ids.map(id => ({ id, index: this.nextIndex++ }));
    this.lastCommitted = entries[entries.length - 1];
    this.listeners.forEach(listener => listener.onCommitted(entries));
  }
}

// Lets the promise chains of the tree monitor and the content save sender run.
async function flush() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

const specFirestore = () => {
  return (firebase.firestore()) as unknown as Firestore;
};

const specDocument = (overrides?: Partial<SnapshotIn<typeof DocumentModel>>) => {
  const props: SnapshotIn<typeof DocumentModel> = {
    type: "problem", key: "doc-key", uid: "1", content: {}, ...overrides };
  return createDocumentModel(props);
};

const specArgs = (type: string, key: string,
                  userOverrides?: Partial<SnapshotIn<typeof UserModel>>,
                  documentOverrides?: Partial<SnapshotIn<typeof DocumentModel>>) => {
  const user = specUser(userOverrides);
  const { id: uid } = user;
  const fb = specFirebase(type, key);
  const firestore = specFirestore();
  const document = specDocument({ type: type as any, key, uid, ...documentOverrides });
  return { user, fb, firestore, document };
};

describe("useDocumentSyncToFirebase hook", () => {

  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    mockUpdate.mockReset();
    mockFirestoreDocUpdate.mockReset();
    mockFirestoreDocUpdate.mockResolvedValue(undefined);
    mockSetLastEditedOnDisconnect.mockReset();
    mockSetLastEditedOnDisconnect.mockReturnValue([]);
    mockSetLastEditedNow.mockReset();
    mockOnlineStatusListenerOff.mockReset();
    mockOnlineStatusListenerOn.mockReset();
    mockRef.mockReset();
    mockRef.mockImplementation((path: string) => {
      return {
        update: (value: any) => Promise.resolve(mockUpdate(value))
      };
    });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("verifies MobX/MST assumptions", () => {
    const value = observable({ foo: "bar" });
    const responder = jest.fn();

    // . access on MobX observable triggers reaction
    const disposer1 = reaction(() => value.foo, () => responder());
    runInAction(() => value.foo = "baz");
    disposer1();
    expect(responder).toHaveBeenCalledTimes(1);

    // [] access on MobX observable triggers reaction
    const prop = "foo";
    const disposer2 = reaction(() => value[prop], () => responder());
    runInAction(() => value.foo = "roo");
    expect(responder).toHaveBeenCalledTimes(2);

    // no reaction if value doesn't change
    runInAction(() => value.foo = "roo");
    disposer2();
    expect(responder).toHaveBeenCalledTimes(2);

    // . access on MST model property triggers reaction
    const document = specDocument();
    const disposer3 = reaction(() => document.visibility, () => responder());
    runInAction(() => document.setVisibility("public"));
    disposer3();
    expect(responder).toHaveBeenCalledTimes(3);

    // [] access on MST model property triggers reaction
    const prop2 = "visibility";
    const disposer4 = reaction(() => document[prop2], () => responder());
    runInAction(() => document.setVisibility("private"));
    expect(responder).toHaveBeenCalledTimes(4);

    // no reaction if value doesn't change
    runInAction(() => document.setVisibility("private"));
    expect(responder).toHaveBeenCalledTimes(4);
    disposer4();
  });

  it("doesn't monitor read-only documents", () => {
    const { user, fb, firestore, document } = specArgs(PlanningDocument, "xyz");
    renderHook(() => useDocumentSyncToFirebase(user, fb, firestore, document, true));
    expect(mockRef).toHaveBeenCalledTimes(0);
    expect(mockUpdate).toHaveBeenCalledTimes(0);
    expect(mockOnlineStatusListenerOn).toHaveBeenCalledTimes(0);

    // doesn't respond to visibility change in read-only documents
    document.setVisibility("public");
    expect(mockRef).toHaveBeenCalledTimes(0);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    // doesn't respond to content change in read-only documents
    document.content?.addTile("text");
    expect(mockRef).toHaveBeenCalledTimes(0);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    // doesn't respond to title change in read-only documents
    document.setTitle("New Title");
    expect(mockRef).toHaveBeenCalledTimes(0);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    // doesn't respond to properties change in read-only documents
    document.setProperty("foo", "bar");
    expect(mockRef).toHaveBeenCalledTimes(0);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    expect(mockSetLastEditedOnDisconnect).toHaveBeenCalledTimes(0);
    expect(mockOnlineStatusListenerOn).toHaveBeenCalledTimes(0);
  });

  it("monitors problem documents", async () => {
    const { user, fb, firestore, document } = specArgs(ProblemDocument, "xyz");
    renderHook(() => useDocumentSyncToFirebase(user, fb, firestore, document));
    // the content save sender's reference
    expect(mockRef).toHaveBeenCalledTimes(1);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/content/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(0);
    expect(mockSetLastEditedOnDisconnect).toHaveBeenCalledTimes(0);
    expect(mockOnlineStatusListenerOn).toHaveBeenCalledTimes(1);

    // updates public/private status on visibility change
    document.setVisibility("public");
    expect(mockRef).toHaveBeenCalledTimes(2);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/problem/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSetLastEditedOnDisconnect).toHaveBeenCalledTimes(0);

    // doesn't respond to title change (problem documents don't have user-settable titles)
    document.setTitle("New Title");
    expect(mockRef).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // doesn't respond to properties change (problem documents don't have user-settable properties)
    document.setProperty("foo", "bar");
    expect(mockRef).toHaveBeenCalledTimes(3);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockSetLastEditedOnDisconnect).toHaveBeenCalledTimes(0);
    expect(mockOnlineStatusListenerOn).toHaveBeenCalledTimes(1);
  });

  it("monitors planning documents", () => {
    const { user, fb, firestore, document } = specArgs(PlanningDocument, "xyz");
    renderHook(() => useDocumentSyncToFirebase(user, fb, firestore, document));
    // the content save sender's reference
    expect(mockRef).toHaveBeenCalledTimes(1);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/content/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(0);
    expect(mockSetLastEditedOnDisconnect).toHaveBeenCalledTimes(0);
    expect(mockOnlineStatusListenerOn).toHaveBeenCalledTimes(1);

    // doesn't respond to visibility change (planning documents are always private)
    document.setVisibility("public");
    expect(mockRef).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    // doesn't respond to title change (planning documents don't have user-settable titles)
    document.setTitle("New Title");
    expect(mockRef).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    // doesn't respond to properties change (planning documents don't have user-settable properties)
    document.setProperty("foo", "bar");
    expect(mockRef).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(0);
    expect(mockSetLastEditedOnDisconnect).toHaveBeenCalledTimes(0);
    expect(mockOnlineStatusListenerOn).toHaveBeenCalledTimes(1);
  });

  it("monitors personal documents", () => {
    const { user, fb, firestore, document } = specArgs(PersonalDocument, "xyz");
    renderHook(() => useDocumentSyncToFirebase(user, fb, firestore, document));
    // the content save sender's reference
    expect(mockRef).toHaveBeenCalledTimes(1);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/content/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(0);
    expect(mockSetLastEditedOnDisconnect).toHaveBeenCalledTimes(0);
    expect(mockOnlineStatusListenerOn).toHaveBeenCalledTimes(1);

    // responds to visibility change
    document.setVisibility("public");
    expect(mockRef).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // updates title when it changes
    document.setTitle("New Title");
    expect(mockRef).toHaveBeenCalledTimes(3);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/personal/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(2);

    // updates properties when they change
    document.setProperty("foo", "bar");
    expect(mockRef).toHaveBeenCalledTimes(4);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/personal/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(3);
    expect(mockSetLastEditedOnDisconnect).toHaveBeenCalledTimes(0);
    expect(mockOnlineStatusListenerOn).toHaveBeenCalledTimes(1);
  });

  it("monitors learning log documents", () => {
    const { user, fb, firestore, document } = specArgs(LearningLogDocument, "xyz");
    renderHook(() => useDocumentSyncToFirebase(user, fb, firestore, document));
    // the content save sender's reference
    expect(mockRef).toHaveBeenCalledTimes(1);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/content/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(0);
    expect(mockSetLastEditedOnDisconnect).toHaveBeenCalledTimes(0);
    expect(mockOnlineStatusListenerOn).toHaveBeenCalledTimes(1);

    // responds to visibility change
    document.setVisibility("public");
    expect(mockRef).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // updates title when it changes
    document.setTitle("New Title");
    expect(mockRef).toHaveBeenCalledTimes(3);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/learningLog/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(2);

    // updates properties when they change
    document.setProperty("foo", "bar");
    expect(mockRef).toHaveBeenCalledTimes(4);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/learningLog/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(3);
    expect(mockSetLastEditedOnDisconnect).toHaveBeenCalledTimes(0);
    expect(mockOnlineStatusListenerOn).toHaveBeenCalledTimes(1);
  });

  it("monitors problem documents with additional logging when DEBUG_SAVE == true", async () => {
    libDebug.DEBUG_SAVE = true;
    const { user, fb, firestore, document } = specArgs(ProblemDocument, "xyz");

    expect.assertions(14);

    // logs monitoring of document
    let unmount: () => void;
    await jestSpyConsole("log", async spy => {
      const { unmount: _unmount } = renderHook(() => useDocumentSyncToFirebase(user, fb, firestore, document));
      unmount = _unmount;
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
      expect(mockRef).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledTimes(0);
    });

    // saves when visibility changes with additional logging
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("log", async spy => {
      document.setVisibility("public");
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(1));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/problem/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    });

    // doesn't respond to title change
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("log", spy => {
      document.setTitle("New Title");
      expect(mockRef).toHaveBeenCalledTimes(0);
      expect(mockUpdate).toHaveBeenCalledTimes(0);
      expect(spy).not.toHaveBeenCalled();
    });

    // responds to properties change when we publish problem documents (pubCount)
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("log", spy => {
      document.setProperty("foo", "bar");
      expect(mockRef).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(spy).not.toHaveBeenCalled();
    });

    // logs unmonitoring of document
    await jestSpyConsole("log", async spy => {
      unmount();
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    });
  });

  it("monitors personal documents with additional logging when DEBUG_SAVE == true", async () => {
    libDebug.DEBUG_SAVE = true;
    const { user, fb, firestore, document } = specArgs(PersonalDocument, "xyz");

    expect.assertions(15);

    // logs monitoring of document
    let unmount: () => void;
    await jestSpyConsole("log", async spy => {
      const { unmount: _unmount } = renderHook(() => useDocumentSyncToFirebase(user, fb, firestore, document));
      unmount = _unmount;
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
      expect(mockRef).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledTimes(0);
    });

    // responds to visibility change
    mockRef.mockClear();
    await jestSpyConsole("log", async spy => {
      document.setVisibility("public");
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    });

    // saves when title changes with additional logging
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("log", async spy => {
      document.setTitle("New Title");
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(1));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/personal/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    });

    // saves when properties change with additional logging
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("log", async spy => {
      document.setProperty("foo", "bar");
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(1));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/metadata/${document.key}/properties`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    });

    // logs unmonitoring of document
    await jestSpyConsole("log", async spy => {
      unmount();
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    });
  });

  it("warns when asked to monitor another user's document", async () => {
    libDebug.DEBUG_SAVE = false;

    const { user, fb, firestore, document } = specArgs(PersonalDocument, "xyz", {}, { uid: "2" });
    jestSpyConsole("warn", mockConsole => {
      renderHook(() => useDocumentSyncToFirebase(user, fb, firestore, document));
      expect(mockConsole).toHaveBeenCalledTimes(1);
    });
    expect(mockRef).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(0);
  });

  it("fails gracefully on problem document save errors", async () => {
    libDebug.DEBUG_SAVE = false;

    expect.assertions(9);

    // alternate failures and success (on retry)
    mockUpdate
      .mockImplementationOnce(() => Promise.reject("No save for you!"))
      .mockImplementationOnce(value => Promise.resolve(value))
      .mockImplementationOnce(() => Promise.reject("No save for you!"))
      .mockImplementationOnce(value => Promise.resolve(value));

    const { user, fb, firestore, document } = specArgs(ProblemDocument, "xyz");
    renderHook(() => useDocumentSyncToFirebase(user, fb, firestore, document));
    expect(mockRef).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    // This use of waitFor makes debugging a failed test very difficult
    // The error message from the expectation seems to be eaten by waitFor
    // The only information will be that the test timed out and the number
    // of assertions is wrong.

    // handles visibility change errors
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("warn", async spy => {
      document.setVisibility("public");
      // assert initial (failed) attempt
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(1));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/problem/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
      // trigger retry (successful) attempt
      jest.runAllTimers();
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(2));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/problem/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));
    });
  });

  it("fails gracefully on personal document save errors", async () => {
    libDebug.DEBUG_SAVE = false;

    expect.assertions(16);

    // alternate failures and success (on retry)
    mockUpdate
      .mockImplementationOnce(() => Promise.reject("No save for you!"))
      .mockImplementationOnce(value => Promise.resolve(value))
      .mockImplementationOnce(() => Promise.reject("No save for you!"))
      .mockImplementationOnce(value => Promise.resolve(value))
      .mockImplementationOnce(() => Promise.reject("No save for you!"))
      .mockImplementationOnce(value => Promise.resolve(value));

    const { user, fb, firestore, document } = specArgs(PersonalDocument, "xyz");
    renderHook(() => useDocumentSyncToFirebase(user, fb, firestore, document));
    expect(mockRef).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    // handles title change errors
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("warn", async spy => {
      document.setTitle("New Title");
      // assert initial (failed) attempt
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(1));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/personal/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
      // trigger retry (successful) attempt
      jest.runAllTimers();
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(2));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/personal/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));
    });

    // handles property change errors
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("warn", async spy => {
      document.setProperty("foo", "bar");
      // assert initial (failed) attempt
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(1));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/metadata/${document.key}/properties`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
      // trigger retry (successful) attempt
      jest.runAllTimers();
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(2));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/metadata/${document.key}/properties`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));
    });
  });

  it("sets window.currentDocument when DOCUMENT_DEBUG is true", () => {
    libDebug.DEBUG_DOCUMENT = true;
    const { user, fb, firestore, document } = specArgs(ProblemDocument, "xyz");
    renderHook(() => useDocumentSyncToFirebase(user, fb, firestore, document));
    expect((window as any).currentDocument).toBe(document);

    (window as any).currentDocument = undefined;
    libDebug.DEBUG_DOCUMENT = false;
    renderHook(() => useDocumentSyncToFirebase(user, fb, firestore, document));
    expect((window as any).currentDocument).toBeUndefined();
  });
  describe("content saves", () => {
    it("attaches a content save sender for an editable document and detaches it on unmount", async () => {
      const getSender = jest.spyOn(senderModule, "getContentSaveSender");
      const detach = jest.spyOn(ContentSaveSender.prototype, "detach");
      const addListener = jest.spyOn(window, "addEventListener");
      const removeListener = jest.spyOn(window, "removeEventListener");
      const logDocumentEvent = jest.spyOn(logDocumentEventModule, "logDocumentEvent").mockImplementation(() => null);
      try {
        const first = jest.fn();
        const second = jest.fn();
        const { user, fb, firestore, document } = specArgs(ProblemDocument, "xyz");
        const { rerender, unmount } = renderHook(({ onContentSaved }) =>
          useDocumentSyncToFirebase(user, fb, firestore, document, false, onContentSaved),
          { initialProps: { onContentSaved: first } });
        expect(getSender).toHaveBeenCalledTimes(1);
        const [senderDocument, options] = getSender.mock.calls[0];
        expect(senderDocument).toBe(document);
        expect(mockRef).toHaveBeenCalledWith(`${user.id}/content/${document.key}`);
        expect(options.contentRef).toBe(mockRef.mock.results[0].value);

        // the disconnect handlers are set up before the first write only
        options.beforeWrite?.();
        options.beforeWrite?.();
        expect(mockSetLastEditedOnDisconnect).toHaveBeenCalledTimes(1);
        expect(mockSetLastEditedOnDisconnect).toHaveBeenCalledWith(user, document.key, user.id);

        // the newest onContentSaved is called
        rerender({ onContentSaved: second });
        expect(getSender).toHaveBeenCalledTimes(1);
        options.onContentSaved?.(document, "e1");
        expect(second).toHaveBeenCalledWith(document, "e1");
        expect(first).not.toHaveBeenCalled();

        // tools go to the Firestore metadata documents
        await options.updateTools(["Text"]);
        expect(mockFirestoreDocUpdate).toHaveBeenCalledWith({ tools: ["Text"] });

        options.logEvent?.(LogEventName.CONTENT_SAVE_FALLBACK_START, { unsettledSince: 1 });
        expect(logDocumentEvent).toHaveBeenCalledWith(LogEventName.CONTENT_SAVE_FALLBACK_START,
          { document, unsettledSince: 1 });

        const pageHideListener = addListener.mock.calls.find(([type]) => (type as string) === "pagehide")?.[1];
        expect(pageHideListener).toBeDefined();
        unmount();
        expect(detach).toHaveBeenCalledTimes(1);
        expect(removeListener).toHaveBeenCalledWith("pagehide", pageHideListener);
        expect(mockSetLastEditedNow).toHaveBeenCalledTimes(1);
      } finally {
        [getSender, detach, addListener, removeListener, logDocumentEvent].forEach(spy => spy.mockRestore());
      }
    });

    it("doesn't create a sender for read-only or published documents, or when sync is disabled", () => {
      const getSender = jest.spyOn(senderModule, "getContentSaveSender");
      try {
        const readOnly = specArgs(ProblemDocument, "xyz");
        renderHook(() => useDocumentSyncToFirebase(readOnly.user, readOnly.fb, readOnly.firestore,
          readOnly.document, true));
        const published = specArgs(ProblemPublication, "xyz");
        renderHook(() => useDocumentSyncToFirebase(published.user, published.fb, published.firestore,
          published.document));
        (window as any).DISABLE_FIREBASE_SYNC = true;
        const disabled = specArgs(ProblemDocument, "xyz");
        renderHook(() => useDocumentSyncToFirebase(disabled.user, disabled.fb, disabled.firestore,
          disabled.document));
        expect(getSender).not.toHaveBeenCalled();
      } finally {
        delete (window as any).DISABLE_FIREBASE_SYNC;
        getSender.mockRestore();
      }
    });

    // A document whose content writes wait until a test resolves them, with a stub commit source.
    function setupSaving(documentOverrides?: Partial<SnapshotIn<typeof DocumentModel>>) {
      const writes: Array<{ values: Record<string, any>, resolve: () => void }> = [];
      const contentUpdate = jest.fn((values: Record<string, any>) =>
        new Promise<void>(resolve => { writes.push({ values, resolve }); }));
      const args = specArgs(ProblemDocument, "xyz", {}, documentOverrides);
      const { user, fb, firestore, document } = args;
      mockRef.mockImplementation((path: string) => path === `${user.id}/content/${document.key}`
        ? { update: contentUpdate, child: () => ({ on: jest.fn(), off: jest.fn() }) }
        : { update: (value: any) => Promise.resolve(mockUpdate(value)) });
      const treeManager = document.treeManagerAPI as TreeManagerType;
      const commits = new StubCommitSource();
      treeManager.setHistoryManager(commits);
      treeManager.exactness.startAt("e0");
      const mount = () => renderHook(() => useDocumentSyncToFirebase(user, fb, firestore, document));

      // Adds a tile and returns the id of the last entry that completed.
      async function addTile() {
        const ids: string[] = [];
        const remove = treeManager.addEntryCompletedListener(entry => { ids.push(entry.id); });
        document.content?.addTile("text");
        await flush();
        remove();
        return ids[ids.length - 1];
      }

      async function resolveWrites() {
        writes.forEach(write => write.resolve());
        await flush();
      }

      return { ...args, commits, contentUpdate, writes, mount, addTile, resolveWrites };
    }

    it("sends the newest committed snapshot on pagehide for an individual document", async () => {
      const { addTile, commits, contentUpdate, mount, resolveWrites, writes } = setupSaving();
      const { unmount } = mount();

      commits.commit(await addTile());
      expect(contentUpdate).toHaveBeenCalledTimes(1);
      const b = await addTile();
      commits.commit(b);
      expect(contentUpdate).toHaveBeenCalledTimes(1);

      window.dispatchEvent(new Event("pagehide"));
      expect(contentUpdate).toHaveBeenCalledTimes(2);
      expect(writes[1].values).toMatchObject({ lastHistoryEntryId: b, settled: true });
      expect(Object.keys(JSON.parse(writes[1].values.content).tileMap)).toHaveLength(2);
      expect(mockSetLastEditedOnDisconnect).toHaveBeenCalledTimes(1);

      await resolveWrites();
      unmount();
    });

    it("doesn't listen for pagehide on a group document", () => {
      const addListener = jest.spyOn(window, "addEventListener");
      const getSender = jest.spyOn(senderModule, "getContentSaveSender");
      try {
        const { mount } = setupSaving({ concurrent: true });
        const { unmount } = mount();
        expect(getSender).toHaveBeenCalledTimes(1);
        expect(addListener.mock.calls.some(([type]) => (type as string) === "pagehide")).toBe(false);
        unmount();
      } finally {
        addListener.mockRestore();
        getSender.mockRestore();
      }
    });

    it("sets the last edited time when the sender finishes saving after unmount", async () => {
      const handlers = [{}];
      mockSetLastEditedOnDisconnect.mockReturnValue(handlers);
      const { addTile, commits, document, mount, resolveWrites, user } = setupSaving();
      const { unmount } = mount();
      commits.commit(await addTile());
      unmount();
      expect(mockSetLastEditedNow).not.toHaveBeenCalled();

      await resolveWrites();
      expect(mockSetLastEditedNow).toHaveBeenCalledTimes(1);
      expect(mockSetLastEditedNow).toHaveBeenCalledWith(user, document.key, user.id, handlers);
    });

    it("keeps the disconnect handlers when the document is mounted again while its sender is saving",
        async () => {
      const handlers = [{}];
      mockSetLastEditedOnDisconnect.mockReturnValue(handlers);
      const { addTile, commits, contentUpdate, document, mount, resolveWrites, user } = setupSaving();
      const first = mount();
      commits.commit(await addTile());
      first.unmount();
      const second = mount();
      await resolveWrites();
      expect(mockSetLastEditedNow).not.toHaveBeenCalled();

      commits.commit(await addTile());
      jest.advanceTimersByTime(senderModule.kMinimumSaveGapMs);
      expect(contentUpdate).toHaveBeenCalledTimes(2);
      await resolveWrites();
      expect(mockSetLastEditedOnDisconnect).toHaveBeenCalledTimes(1);
      second.unmount();
      expect(mockSetLastEditedNow).toHaveBeenCalledTimes(1);
      expect(mockSetLastEditedNow).toHaveBeenCalledWith(user, document.key, user.id, handlers);
    });

    it("sets the last edited time at once when nothing is left to save at unmount", async () => {
      const { addTile, commits, mount, resolveWrites } = setupSaving();
      const { unmount } = mount();
      commits.commit(await addTile());
      await resolveWrites();
      unmount();
      expect(mockSetLastEditedNow).toHaveBeenCalledTimes(1);
    });
  });
});
