import { renderHook } from "@testing-library/react-hooks";
import { observable, reaction, runInAction } from "mobx";
import { SnapshotIn } from "mobx-state-tree";
import { UseMutationOptions } from "react-query";
import { Firebase } from "../lib/firebase";
import { DocumentModel } from "../models/document/document";
import {
  LearningLogDocument, PersonalDocument, PlanningDocument, ProblemDocument
} from "../models/document/document-types";
import { UserModel, UserModelType } from "../models/stores/user";
import { useDocumentSyncToFirebase } from "./use-document-sync-to-firebase";
const libDebug = require("../lib/debug");

import "../models/tools/text/text-registration";

var mockUseMutation = jest.fn((callback: (vars: any) => Promise<any>, options?: UseMutationOptions) => {
  return {
    mutate: (vars: any) => {
      callback(vars)
        .then(data => { options?.onSuccess?.(data, vars, {}); })
        .catch(err => {
          options?.onError?.(err, vars, {});
          if (((typeof options?.retry === "boolean") && options.retry) ||
              ((typeof options?.retry === "function") && options.retry(1, "error"))) {
            const delay = ((typeof options?.retryDelay === "number") && options.retryDelay) ||
                          ((typeof options?.retryDelay === "function") && options.retryDelay(1, "error"));
            // make it async, but minimal delay for testing purposes
            setTimeout(() => {
              try {
                callback(vars);
              }
              catch(e) {
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

var mockUpdate = jest.fn();
var mockRef = jest.fn();

const specUser = (overrides?: Partial<SnapshotIn<typeof UserModel>>) => {
  return UserModel.create({ id: "1", ...overrides });
};

const specFirebase = (type: string, key: string) => {
  return {
    getUserDocumentPaths: (user: UserModelType) => {
      return {
        content: `${user.id}/content/${key}`,
        metadata: `${user.id}/metadata/${key}`,
        typedMetadata: `${user.id}/${type}/${key}`
      };
    },
    ref: (path: string) => mockRef(path)
  } as unknown as Firebase;
};

const specDocument = (overrides?: Partial<SnapshotIn<typeof DocumentModel>>) => {
  const props: SnapshotIn<typeof DocumentModel> = {
    type: "problem", key: "doc-key", uid: "1", content: {}, ...overrides };
  return DocumentModel.create(props);
};

const specArgs = (type: string, key: string,
                  userOverrides?: Partial<SnapshotIn<typeof UserModel>>,
                  documentOverrides?: Partial<SnapshotIn<typeof DocumentModel>>) => {
  const user = specUser(userOverrides);
  const { id: uid } = user;
  const firebase = specFirebase(type, key);
  const document = specDocument({ type: type as any, key, uid, ...documentOverrides });
  return { user, firebase, document };
};

describe("useDocumentSyncToFirebase hook", () => {

  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    mockUpdate.mockReset();
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
    const { user, firebase, document } = specArgs(PlanningDocument, "xyz");
    renderHook(() => useDocumentSyncToFirebase(user, firebase, document, true));
    expect(mockRef).toHaveBeenCalledTimes(0);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

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
  });

  it("monitors problem documents", async () => {
    const { user, firebase, document } = specArgs(ProblemDocument, "xyz");
    renderHook(() => useDocumentSyncToFirebase(user, firebase, document));
    expect(mockRef).toHaveBeenCalledTimes(0);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    // updates public/private status on visibility change
    document.setVisibility("public");
    expect(mockRef).toBeCalledTimes(1);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/problem/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // saves when content changes
    document.content?.addTile("text");
    expect(mockRef).toHaveBeenCalledTimes(2);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/content/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(2);

    // doesn't respond to title change (problem documents don't have user-settable titles)
    document.setTitle("New Title");
    expect(mockRef).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledTimes(2);

    // doesn't respond to properties change (problem documents don't have user-settable properties)
    document.setProperty("foo", "bar");
    expect(mockRef).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it("monitors planning documents", () => {
    const { user, firebase, document } = specArgs(PlanningDocument, "xyz");
    renderHook(() => useDocumentSyncToFirebase(user, firebase, document));
    expect(mockRef).toHaveBeenCalledTimes(0);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    // doesn't respond to visibility change (planning documents are always private)
    document.setVisibility("public");
    expect(mockRef).toHaveBeenCalledTimes(0);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    // saves when content changes
    document.content?.addTile("text");
    expect(mockRef).toHaveBeenCalledTimes(1);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/content/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // doesn't respond to title change (planning documents don't have user-settable titles)
    document.setTitle("New Title");
    expect(mockRef).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // doesn't respond to properties change (planning documents don't have user-settable properties)
    document.setProperty("foo", "bar");
    expect(mockRef).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("monitors personal documents", () => {
    const { user, firebase, document } = specArgs(PersonalDocument, "xyz");
    renderHook(() => useDocumentSyncToFirebase(user, firebase, document));
    expect(mockRef).toHaveBeenCalledTimes(0);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    // doesn't respond to visibility change (personal documents don't have visibility)
    document.setVisibility("public");
    expect(mockRef).toHaveBeenCalledTimes(0);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    // saves when content changes
    document.content?.addTile("text");
    expect(mockRef).toHaveBeenCalledTimes(1);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/content/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // updates title when it changes
    document.setTitle("New Title");
    expect(mockRef).toHaveBeenCalledTimes(2);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/personal/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(2);

    // updates properties when they change
    document.setProperty("foo", "bar");
    expect(mockRef).toHaveBeenCalledTimes(3);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/personal/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });

  it("monitors learning log documents", () => {
    const { user, firebase, document } = specArgs(LearningLogDocument, "xyz");
    renderHook(() => useDocumentSyncToFirebase(user, firebase, document));
    expect(mockRef).toHaveBeenCalledTimes(0);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    // doesn't respond to visibility change (learning logs don't have visibility)
    document.setVisibility("public");
    expect(mockRef).toHaveBeenCalledTimes(0);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    // saves when content changes
    document.content?.addTile("text");
    expect(mockRef).toHaveBeenCalledTimes(1);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/content/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // updates title when it changes
    document.setTitle("New Title");
    expect(mockRef).toHaveBeenCalledTimes(2);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/learningLog/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(2);

    // updates properties when they change
    document.setProperty("foo", "bar");
    expect(mockRef).toHaveBeenCalledTimes(3);
    expect(mockRef).toHaveBeenCalledWith(`${user.id}/learningLog/${document.key}`);
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });

  it("monitors problem documents with additional logging when DEBUG_SAVE == true", async () => {
    libDebug.DEBUG_SAVE = true;
    const { user, firebase, document } = specArgs(ProblemDocument, "xyz");

    expect.assertions(18);

    // logs monitoring of document
    let unmount: () => void;
    let waitFor: (callback: () => boolean | void) => Promise<void>;
    await jestSpyConsole("log", async spy => {
      const { unmount: _unmount, waitFor: _waitFor } =
        renderHook(() => useDocumentSyncToFirebase(user, firebase, document));
      unmount = _unmount;
      waitFor = _waitFor;
      await waitFor(() => expect(spy).toBeCalledTimes(1));
      expect(mockRef).toHaveBeenCalledTimes(0);
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
      await waitFor(() => expect(spy).toBeCalledTimes(1));
    });

    // doesn't respond to title change
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("log", spy => {
      document.setTitle("New Title");
      expect(mockRef).toHaveBeenCalledTimes(0);
      expect(mockUpdate).toHaveBeenCalledTimes(0);
      expect(spy).not.toBeCalled();
    });

    // doesn't respond to properties change
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("log", spy => {
      document.setProperty("foo", "bar");
      expect(mockRef).toHaveBeenCalledTimes(0);
      expect(mockUpdate).toHaveBeenCalledTimes(0);
      expect(spy).not.toBeCalled();
    });

    // saves when content changes with additional logging
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("log", async spy => {
      document.content?.addTile("text");
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(1));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/content/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(spy).toBeCalledTimes(1));
    });

    // logs unmonitoring of document
    await jestSpyConsole("log", async spy => {
      unmount();
      await waitFor(() => expect(spy).toBeCalledTimes(1));
    });
  });

  it("monitors personal documents with additional logging when DEBUG_SAVE == true", async () => {
    libDebug.DEBUG_SAVE = true;
    const { user, firebase, document } = specArgs(PersonalDocument, "xyz");

    expect.assertions(19);

    // logs monitoring of document
    let unmount: () => void;
    let waitFor: (callback: () => boolean | void) => Promise<void>;
    await jestSpyConsole("log", async spy => {
      const { unmount: _unmount, waitFor: _waitFor } =
        renderHook(() => useDocumentSyncToFirebase(user, firebase, document));
      unmount = _unmount;
      waitFor = _waitFor;
      await waitFor(() => expect(spy).toBeCalledTimes(1));
      expect(mockRef).toHaveBeenCalledTimes(0);
      expect(mockUpdate).toHaveBeenCalledTimes(0);
    });

    // doesn't respond to visibility change
    await jestSpyConsole("log", spy => {
      document.setVisibility("public");
      jest.runAllTimers();
      expect(spy).not.toBeCalled();
    });
    expect(mockRef).toHaveBeenCalledTimes(0);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    // saves when title changes with additional logging
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("log", async spy => {
      document.setTitle("New Title");
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(1));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/personal/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(spy).toBeCalledTimes(1));
    });

    // saves when properties change with additional logging
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("log", async spy => {
      document.setProperty("foo", "bar");
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(1));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/personal/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(spy).toBeCalledTimes(1));
    });

    // saves when content changes with additional logging
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("log", async spy => {
      document.content?.addTile("text");
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(1));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/content/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(spy).toBeCalledTimes(1));
    });

    // logs unmonitoring of document
    await jestSpyConsole("log", async spy => {
      unmount();
      await waitFor(() => expect(spy).toBeCalledTimes(1));
    });
  });

  it("warns when asked to monitor another user's document", async () => {
    libDebug.DEBUG_SAVE = false;

    const { user, firebase, document } = specArgs(PersonalDocument, "xyz", {}, { uid: "2" });
    jestSpyConsole("warn", mockConsole => {
      renderHook(() => useDocumentSyncToFirebase(user, firebase, document));
      expect(mockConsole).toHaveBeenCalledTimes(1);
    });
    expect(mockRef).toHaveBeenCalledTimes(0);
    expect(mockUpdate).toHaveBeenCalledTimes(0);
  });

  it("fails gracefully on problem document save errors", async () => {
    libDebug.DEBUG_SAVE = false;

    expect.assertions(16);

    // alternate failures and success (on retry)
    mockUpdate
      .mockImplementationOnce(() => Promise.reject("No save for you!"))
      .mockImplementationOnce(value => Promise.resolve(value))
      .mockImplementationOnce(() => Promise.reject("No save for you!"))
      .mockImplementationOnce(value => Promise.resolve(value));

    const { user, firebase, document } = specArgs(ProblemDocument, "xyz");
    const { waitFor } = renderHook(() => useDocumentSyncToFirebase(user, firebase, document));
    expect(mockRef).toHaveBeenCalledTimes(0);
    expect(mockUpdate).toHaveBeenCalledTimes(0);

    // handles visibility change errors
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("warn", async spy => {
      document.setVisibility("public");
      // assert initial (failed) attempt
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(1));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/problem/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(spy).toBeCalledTimes(1));
      // trigger retry (successful) attempt
      jest.runAllTimers();
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(2));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/problem/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));
    });

    // handles content change errors
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("warn", async spy => {
      document.content?.addTile("text");
      // assert initial (failed) attempt
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(1));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/content/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(spy).toBeCalledTimes(1));
      // trigger retry (successful) attempt
      jest.runAllTimers();
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(2));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/content/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));
    });
  });

  it("fails gracefully on personal document save errors", async () => {
    libDebug.DEBUG_SAVE = false;

    expect.assertions(23);

    // alternate failures and success (on retry)
    mockUpdate
      .mockImplementationOnce(() => Promise.reject("No save for you!"))
      .mockImplementationOnce(value => Promise.resolve(value))
      .mockImplementationOnce(() => Promise.reject("No save for you!"))
      .mockImplementationOnce(value => Promise.resolve(value))
      .mockImplementationOnce(() => Promise.reject("No save for you!"))
      .mockImplementationOnce(value => Promise.resolve(value));

    const { user, firebase, document } = specArgs(PersonalDocument, "xyz");
    const { waitFor } =
      renderHook(() => useDocumentSyncToFirebase(user, firebase, document));
    expect(mockRef).toHaveBeenCalledTimes(0);
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
      await waitFor(() => expect(spy).toBeCalledTimes(1));
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
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/personal/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(spy).toBeCalledTimes(1));
      // trigger retry (successful) attempt
      jest.runAllTimers();
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(2));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/personal/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));
    });

    // handles content change errors
    mockRef.mockClear();
    mockUpdate.mockClear();
    await jestSpyConsole("warn", async spy => {
      document.content?.addTile("text");
      // assert initial (failed) attempt
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(1));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/content/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(spy).toBeCalledTimes(1));
      // trigger retry (successful) attempt
      jest.runAllTimers();
      await waitFor(() => expect(mockRef).toHaveBeenCalledTimes(2));
      expect(mockRef).toHaveBeenCalledWith(`${user.id}/content/${document.key}`);
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));
    });
  });
});
