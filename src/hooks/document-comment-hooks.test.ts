import { renderHook } from "@testing-library/react-hooks";
import { IDocumentMetadata } from "../../functions/src/shared";
import { CommentDocument } from "../lib/firestore-schema";
import {
  DocumentQueryType, useDocumentComments, usePostDocumentComment, useUnreadDocumentComments
} from "./document-comment-hooks";

var mockValidateCommentableDocument_v1 = jest.fn();
var mockPostDocumentComment_v1 = jest.fn();
var mockHttpsCallable = jest.fn((fn: string) => {
  switch(fn) {
    case "validateCommentableDocument_v1":
      return mockValidateCommentableDocument_v1;
    case "postDocumentComment_v1":
      return mockPostDocumentComment_v1;
  }
});
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
var mockCurriculumDocument = { unit: "unit", problem: "1.1", section: "intro", path: "unit/1/1/intro" };
var mockUseQuery = jest.fn(() => ({
  isLoading: false,
  isError: false,
  isSuccess: true,
  data: Promise.resolve(mockCurriculumDocument)
}));
jest.mock("react-query", () => ({
  useMutation: (callback: () => void) => mockUseMutation(callback),
  useQuery: (key: string, fn: () => Promise<DocumentQueryType>) => mockUseQuery()
}));

var mockUseDocumentOrCurriculumMetadata = jest.fn((docKeyOrSectionPath: string) => {
  return mockCurriculumDocument;
});
jest.mock("./use-stores", () => ({
  useDocumentOrCurriculumMetadata:
    (docKeyOrSectionPath: string) => mockUseDocumentOrCurriculumMetadata(docKeyOrSectionPath),
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
  useFirestore: () => ([
    {
      documentRef: (path: string) => jest.fn()
    },
    "firestore/root"
  ]),
  useCollectionOrderedRealTimeQuery:
    (path: string, options?: any) => mockUseCollectionOrderedRealTimeQuery(path, options)
}));

describe("Document comment hooks", () => {

  beforeEach(() => {
    mockValidateCommentableDocument_v1.mockClear();
    mockPostDocumentComment_v1.mockClear();
    mockHttpsCallable.mockClear();
    mockUseMutation.mockClear();
    mockUseCollectionOrderedRealTimeQuery.mockClear();
  });

  describe("postDocumentComment", () => {
    it("should work as expected", () => {
      const { result } = renderHook(() => usePostDocumentComment());
      expect(mockUseMutation).toHaveBeenCalled();
      expect(typeof result.current.mutate).toBe("function");
      result.current.mutate({ document: { key: "key" } as IDocumentMetadata , comment: { content: "foo" } });
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
