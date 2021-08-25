import { renderHook } from "@testing-library/react-hooks";
import { IDocumentMetadata } from "../../functions/src/shared-types";
import { CommentDocument } from "../lib/firestore-schema";
import { useDocumentComments, usePostDocumentComment, useUnreadDocumentComments } from "./document-comment-hooks";

var mockPostDocumentComment_v1 = jest.fn();
var mockHttpsCallable = jest.fn((fn: string) => mockPostDocumentComment_v1);
jest.mock("firebase/app", () => ({
  firestore: {
    Timestamp: {
      fromDate: (date: Date) => ({
        toDate: () => date
      })
    }
  },
  functions: () => ({
    httpsCallable: (fn: string) => mockHttpsCallable(fn)
  })
}));

var mockUseMutation = jest.fn((callback: () => void) => {
  return { mutate: () => callback() };
});
jest.mock("react-query", () => ({
  useMutation: (callback: () => void) => mockUseMutation(callback)
}));

jest.mock("./use-stores", () => ({
  useNetworkDocumentKey: (documentKey: string) => `network_${documentKey}`
}));

jest.mock("./use-user-context", () => ({
  useUserContext: () => ({ appMode: "test", classHash: "class-hash" })
}));

var mockUseCollectionOrderedRealTimeQuery = jest.fn((path: string, options?: any) => {
  if (options?.converter) {
    let jsComment: CommentDocument = {
      uid: "1", name: "T", network: "foo", content: "bar"
    } as CommentDocument;
    let fsComment = options.converter.toFirestore(jsComment);
    let convertedComment = options.converter.fromFirestore({ data: () => fsComment });
    expect(convertedComment).toEqual(jsComment);

    jsComment = { ...jsComment, createdAt: new Date() };
    fsComment = options.converter.toFirestore(jsComment);
    convertedComment = options.converter.fromFirestore({ data: () => fsComment });
    expect(convertedComment).toEqual(jsComment);
  }
});
jest.mock("./firestore-hooks", () => ({
  useCollectionOrderedRealTimeQuery:
    (path: string, options?: any) => mockUseCollectionOrderedRealTimeQuery(path, options)
}));

describe("Document comment hooks", () => {

  beforeEach(() => {
    mockUseMutation.mockClear();
    mockUseCollectionOrderedRealTimeQuery.mockClear();
  });

  describe("postDocumentComment", () => {
    it("should work as expected", () => {
      const { result } = renderHook(() => usePostDocumentComment());
      expect(mockUseMutation).toHaveBeenCalled();
      expect(typeof result.current.mutate).toBe("function");
      result.current.mutate({ document: { key: "key" } as IDocumentMetadata , comment: "foo" });
      expect(mockHttpsCallable).toHaveBeenCalled();
      expect(mockHttpsCallable.mock.calls[0][0]).toBe("postDocumentComment_v1");
      expect(mockPostDocumentComment_v1).toHaveBeenCalled();
    });
  });

  describe("useDocumentComments", () => {
    it("should handle empty path string", () => {
      renderHook(() => useDocumentComments(""));
      expect(mockUseCollectionOrderedRealTimeQuery).toHaveBeenCalled();
      expect(mockUseCollectionOrderedRealTimeQuery.mock.calls[0][0]).toBe("");
    });

    it("should work as expected", () => {
      renderHook(() => useDocumentComments("foo"));
      expect(mockUseCollectionOrderedRealTimeQuery).toHaveBeenCalled();
      expect(mockUseCollectionOrderedRealTimeQuery.mock.calls[0][0]).toBe("documents/network_foo/comments");
    });
  });

  describe("useUnreadDocumentComments", () => {
    it("should handle empty path string", () => {
      renderHook(() => useUnreadDocumentComments(""));
      expect(mockUseCollectionOrderedRealTimeQuery).toHaveBeenCalled();
      expect(mockUseCollectionOrderedRealTimeQuery.mock.calls[0][0]).toBe("");
    });

    it("should work as expected", () => {
      renderHook(() => useUnreadDocumentComments("bar"));
      expect(mockUseCollectionOrderedRealTimeQuery).toHaveBeenCalled();
      expect(mockUseCollectionOrderedRealTimeQuery.mock.calls[0][0]).toBe("documents/network_bar/comments");
    });
  });

});
