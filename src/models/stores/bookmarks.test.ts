import { observable } from 'mobx';
import { mock } from 'ts-jest-mocker';
import { DB } from "../../lib/db";
import { Bookmark, Bookmarks } from './bookmarks';
import { ClassModelType } from './class';
// Get a writable instance of the debug constant
const libDebug = require("../../lib/debug");

function addDocBookmarks(bookmarks: Bookmarks, bookmarkMap: Record<string, Array<Bookmark>>) {
  Object.entries(bookmarkMap).forEach(([docKey, array]) => {
    bookmarks.bookmarkMap.set(docKey, observable.array(array));
  });
}

function initialize() {
  const db = mock(DB);
  // We have to make sure the prototype of the mocked db is something other
  // than the default which is just Object. Without this change MobX tries
  // to wrap the mock db object to make it observable. This happens when
  // the db is assigned to the bookmarks.db property. Since we have to
  // set the prototype we might as well as set it to the actual DB class.
  // This issue could probably be fixed within ts-jest-mocker by defining
  // the getPrototypeOf() on the handler in its createClassProxy.
  Object.setPrototypeOf(db, DB);
  const bookmarks = new Bookmarks({db});
  return {db, bookmarks };
}

describe("Bookmarks Store", () => {

  // Note: currently ts-jest-mocker does not throw an error if an un-mocked
  // function is called, it just returns undefined, so errors from un-mocked
  // functions will be harder to track down
  test("isDocumentBookmarked", () => {
    const { bookmarks } = initialize();
    const docKey1 = "1";
    const docKey2 = "2";
    const docKey3 = "3";

    addDocBookmarks(bookmarks, {
      [docKey1]: [
        new Bookmark("1", "a", false),
        new Bookmark("2", "b", true),
      ],
      [docKey2]: [
        new Bookmark("1", "c", false),
        new Bookmark("2", "d", false),
      ],
      [docKey3]: [
        new Bookmark("1", "e", true),
        new Bookmark("2", "f", true),
      ],
    });

    expect(bookmarks.isDocumentBookmarked(docKey1)).toBe(true);
    expect(bookmarks.isDocumentBookmarked(docKey2)).toBe(false);
    expect(bookmarks.isDocumentBookmarked(docKey3)).toBe(true);
    expect(bookmarks.isDocumentBookmarked("unknown doc")).toBe(false);
  });

  test("isDocumentBookmarkedByUser", () => {
    const { bookmarks } = initialize();

    const docKey1 = "1";
    addDocBookmarks(bookmarks, {
      [docKey1]: [
        new Bookmark("1", "a", false),
        new Bookmark("2", "b", true),
      ]
    });
    expect(bookmarks.isDocumentBookmarkedByUser(docKey1, "1")).toBe(false);
    expect(bookmarks.isDocumentBookmarkedByUser(docKey1, "2")).toBe(true);
    expect(bookmarks.isDocumentBookmarkedByUser(docKey1, "unknown user")).toBe(false);
    expect(bookmarks.isDocumentBookmarkedByUser("unknown doc", "1")).toBe(false);
  });

  test("getOrCreateDocumentBookmarks", () => {
    const { bookmarks } = initialize();
    const docKey1 = "1";
    addDocBookmarks(bookmarks, {
      [docKey1]: [
        new Bookmark("1", "a", false),
        new Bookmark("2", "b", true),
      ]
    });

    const docBookmarks1 = bookmarks.getOrCreateDocumentBookmarks(docKey1);
    expect(docBookmarks1).toBeDefined();
    expect(docBookmarks1.length).toBe(2);

    const docBookmarks2 = bookmarks.getOrCreateDocumentBookmarks("new key");
    expect(docBookmarks2).toBeDefined();
    expect(docBookmarks2.length).toBe(0);
  });

  test("getDocumentUserBookmark", () => {
    const { bookmarks } = initialize();
    const docKey1 = "1";
    const srcBookmark1 = new Bookmark("1", "a", false);
    const srcBookmark2 = new Bookmark("2", "b", true);
    addDocBookmarks(bookmarks, {
      [docKey1]: [
        srcBookmark1,
        srcBookmark2
      ]
    });

    const bookmark1 = bookmarks.getDocumentUserBookmark(docKey1, "1");
    expect(bookmark1).toEqual(srcBookmark1);
    const bookmark2 = bookmarks.getDocumentUserBookmark(docKey1, "2");
    expect(bookmark2).toEqual(srcBookmark2);
    const bookmark3 = bookmarks.getDocumentUserBookmark(docKey1, "unknown user");
    expect(bookmark3).toBeUndefined();
    const bookmark4 = bookmarks.getDocumentUserBookmark("unknown doc", "1");
    expect(bookmark4).toBeUndefined();
  });

  test("getDocumentBookmark", () => {
    const { bookmarks } = initialize();
    const docKey1 = "1";
    const srcBookmark1 = new Bookmark("1", "a", false);
    const srcBookmark2 = new Bookmark("2", "b", true);
    addDocBookmarks(bookmarks, {
      [docKey1]: [
        srcBookmark1,
        srcBookmark2
      ]
    });

    const bookmark1 = bookmarks.getDocumentBookmark(docKey1, "a");
    expect(bookmark1).toEqual(srcBookmark1);
    const bookmark2 = bookmarks.getDocumentBookmark(docKey1, "b");
    expect(bookmark2).toEqual(srcBookmark2);
    const bookmark3 = bookmarks.getDocumentBookmark(docKey1, "unknown key");
    expect(bookmark3).toBeUndefined();
    const bookmark4 = bookmarks.getDocumentBookmark("unknown doc", "a");
    expect(bookmark4).toBeUndefined();
  });

  test("updateDocumentBookmark", () => {
    const { bookmarks } = initialize();
    const docKey1 = "1";
    addDocBookmarks(bookmarks, {
      [docKey1]: [
        new Bookmark("1", "a", false),
        new Bookmark("2", "b", true),
      ]
    });

    const originalBookmark1 = bookmarks.getDocumentUserBookmark(docKey1, "1");
    expect(bookmarks.isDocumentBookmarkedByUser(docKey1, "1")).toBe(false);
    bookmarks.updateDocumentBookmark(docKey1, new Bookmark("1", "a", true));
    expect(bookmarks.isDocumentBookmarkedByUser(docKey1, "1")).toBe(true);

    // After the update the original bookmark object should be the same instance
    // this way the bookmark objects can be held onto by components.
    // We might want to drop this constraint though so that bookmarks are either
    // defined or undefined and no longer have a "starred" flag. In that case
    // we should probably never return the actual bookmark object.
    const updatedBookmark1 = bookmarks.getDocumentUserBookmark(docKey1, "1");
    expect(updatedBookmark1).toBe(originalBookmark1);

    const originalBookmark2 = bookmarks.getDocumentUserBookmark(docKey1, "3");
    expect(originalBookmark2).toBeUndefined();
    expect(bookmarks.isDocumentBookmarkedByUser(docKey1, "3")).toBe(false);
    bookmarks.updateDocumentBookmark(docKey1, new Bookmark("3", "c", true));
    expect(bookmarks.isDocumentBookmarkedByUser(docKey1, "3")).toBe(true);
    const updatedBookmark2 = bookmarks.getDocumentUserBookmark(docKey1, "3");
    expect(updatedBookmark2).toBeDefined();
  });

  test("updateDocumentBookmark with corrupt data", async () => {
    const { bookmarks } = initialize();
    const docKey1 = "1";
    addDocBookmarks(bookmarks, {
      [docKey1]: [
        new Bookmark("1", "a", false),
        new Bookmark("2", "b", true),
      ]
    });

    // Try to change the user id of a bookmark that already exists
    await jestSpyConsole("warn", async consoleWarn => {
      bookmarks.updateDocumentBookmark(docKey1, new Bookmark("3", "b", true));
      expect(bookmarks.isDocumentBookmarkedByUser(docKey1, "3")).toBe(false);
      expect(consoleWarn).toHaveBeenCalledTimes(1);
    });
  });

  test("toggleUserBookmark", async () => {
    const { bookmarks, db } = initialize();
    const docKey1 = "1";
    addDocBookmarks(bookmarks, {
      [docKey1]: [
        new Bookmark("1", "a", false),
        new Bookmark("2", "b", true),
      ]
    });

    bookmarks.toggleUserBookmark(docKey1, "1");
    expect(db.setUserStarState).toHaveBeenCalledWith(docKey1, "a", true);

    bookmarks.toggleUserBookmark(docKey1, "unknown user1");
    expect(db.createUserStar).toHaveBeenCalledWith(docKey1, true);

    libDebug.DEBUG_BOOKMARKS = false;
    await jestSpyConsole("log", async consoleLog => {
      bookmarks.toggleUserBookmark(docKey1, "1");
      expect(consoleLog).not.toHaveBeenCalled();
    });

    libDebug.DEBUG_BOOKMARKS = true;
    await jestSpyConsole("log", async consoleLog => {
      bookmarks.toggleUserBookmark(docKey1, "1");
      bookmarks.toggleUserBookmark(docKey1, "unknown user2");
      bookmarks.toggleUserBookmark("unknown doc", "1");
      expect(consoleLog).toHaveBeenCalledTimes(3);
    });
  });

  test("getBookmarkLabel", () => {
    const { bookmarks } = initialize();
    const docKey1 = "1";
    const docKey2 = "2";
    addDocBookmarks(bookmarks, {
      [docKey1]: [
        new Bookmark("1", "a", true),
        new Bookmark("2", "b", true),
        new Bookmark("1001", "c", true),
      ],
      [docKey2]: [
        new Bookmark("1", "d", true),
        new Bookmark("1001", "f", false),
      ]
    });

    const classStore = mock<ClassModelType>();
    classStore.isTeacher.mockImplementation(uid => Number(uid) > 1000);
    expect(bookmarks.getBookmarkLabel("unknown doc", "1", classStore)).toBe("");
    expect(bookmarks.getBookmarkLabel(docKey1, "1", classStore)).toBe("U1 T1 O1");
    expect(bookmarks.getBookmarkLabel(docKey1, "1001", classStore)).toBe("U1    O2");
    expect(bookmarks.getBookmarkLabel(docKey2, "1", classStore)).toBe("U1      ");
  });
});
