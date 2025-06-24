import { renderHook } from "@testing-library/react-hooks";
import { CommentDocument } from "../lib/firestore-schema";
import {
  DocumentQueryType, useDocumentComments, usePostDocumentComment, useUnreadDocumentComments
} from "./document-comment-hooks";

const mockPostDocumentComment_v2 = jest.fn();
const mockHttpsCallable = jest.fn((fn: string) => {
  switch(fn) {
    case "postDocumentComment_v2":
      return mockPostDocumentComment_v2;
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

// mock QueryClient methods
const mockGetQueryData = jest.fn();
const mockSetQueryData = jest.fn();
// tests may override implementation to simulate mutation succeeding (default) or failing
const mockMutateSuccessOrError = jest.fn();
const mockUseMutation = jest.fn((mutateFn: (params: any) => void, options: any) => {
  return {
    mutate: async (params: any) => {
      mutateFn(params);
      const mutationContext = await options?.onMutate?.(params);
      mockMutateSuccessOrError(params, options, mutationContext);
    }
  };
});
const mockCurriculumDocument = { unit: "unit", problem: "1.1", section: "intro", path: "unit/1/1/intro" };
const mockUseQuery = jest.fn((key: string, fn: () => Promise<DocumentQueryType>, options: any) => ({
  isLoading: false,
  isError: false,
  isSuccess: true,
  data: Promise.resolve(mockCurriculumDocument)
}));
jest.mock("react-query", () => ({
  useMutation: (mutateFn: (params: any) => void, options: any) => mockUseMutation(mutateFn, options),
  useQuery: (key: string, fn: () => Promise<DocumentQueryType>, options: any) => mockUseQuery(key, fn, options),
  useQueryClient: () => ({
    getQueryData: mockGetQueryData,
    setQueryData: mockSetQueryData
  })
}));

const mockUseDocumentOrCurriculumMetadata = jest.fn((docKeyOrSectionPath: string) => {
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

const mockUseCollectionOrderedRealTimeQuery = jest.fn((path: string, options?: any) => {
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

  function resetMocks() {
    mockPostDocumentComment_v2.mockClear();
    mockHttpsCallable.mockClear();
    mockUseMutation.mockClear();
    mockMutateSuccessOrError.mockReset();
    // default implementation calls onSuccess
    mockMutateSuccessOrError.mockImplementation((params: any, options: any, context?: any) => {
      const mutationResult = {};
      options?.onSuccess?.(mutationResult, params, context);
    });
    mockGetQueryData.mockReset();
    // default implementation returns empty array
    mockGetQueryData.mockImplementation(() => []);
    mockSetQueryData.mockReset();
    mockUseCollectionOrderedRealTimeQuery.mockClear();
  }

  describe("postDocumentComment", () => {
    beforeEach(() => resetMocks());

    it("should post comment successfully with optimistic update", () => {
      const document = { uid: "user-id", type: "problem", key: "key" };
      // useDocumentComments() fills the commentsQueryKeyMap
      renderHook(() => useDocumentComments(document.key));
      expect(mockUseCollectionOrderedRealTimeQuery).toHaveBeenCalled();
      const { result: postCommentResult } = renderHook(() => usePostDocumentComment());
      expect(mockUseMutation).toHaveBeenCalled();
      expect(typeof postCommentResult.current.mutate).toBe("function");
      postCommentResult.current.mutate({ document, comment: { content: "foo" } });
      expect(mockGetQueryData).toHaveBeenCalled();
      expect(mockSetQueryData).toHaveBeenCalled();
      expect(mockSetQueryData.mock.calls[0][1]).toHaveLength(1);
      expect(mockHttpsCallable).toHaveBeenCalled();
      expect(mockHttpsCallable.mock.calls[0][0]).toBe("postDocumentComment_v2");
      expect(mockPostDocumentComment_v2).toHaveBeenCalled();
    });

    it("should roll back optimistic update on error", async () => {
      mockMutateSuccessOrError.mockImplementation((params: any, options: any, context?: any) => {
        // call onError instead of onSuccess
        const mutationResult = new Error("Failed");
        options?.onError?.(mutationResult, params, context);
      });
      const document = { uid: "user-id", type: "problem", key: "key" };
      // useDocumentComments() fills the commentsQueryKeyMap
      renderHook(() => useDocumentComments(document.key));
      const { result: postCommentResult } = renderHook(() => usePostDocumentComment());
      expect(mockUseMutation).toHaveBeenCalled();
      expect(typeof postCommentResult.current.mutate).toBe("function");
      await postCommentResult.current.mutate({ document, comment: { content: "foo" } });
      expect(mockGetQueryData).toHaveBeenCalled();
      // one optimistic call and one rollback call
      expect(mockSetQueryData).toHaveBeenCalledTimes(2);
      // first call is optimistic, contains one comment
      expect(mockSetQueryData.mock.calls[0][1]).toHaveLength(1);
      // second call is rollback, contains no comments
      expect(mockSetQueryData.mock.calls[1][1]).toHaveLength(0);
      expect(mockPostDocumentComment_v2).toHaveBeenCalled();
    });
  });

  describe("useDocumentComments", () => {
    beforeEach(() => resetMocks());

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
    beforeEach(() => resetMocks());

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
