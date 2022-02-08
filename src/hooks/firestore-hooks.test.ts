import firebase from "firebase/app";
import { renderHook } from "@testing-library/react-hooks";
import { useCollectionOrderedRealTimeQuery, useDeleteDocument, useFirestoreTeacher } from "./firestore-hooks";

var mockData = [
  { id: 1, value: "foo" },
  { id: 2, value: "bar" }
];
var mockSetQueryData = jest.fn();
var mockUseQuery = jest.fn((...args) => ({
  isLoading: false,
  isError: false,
  data: mockData,
  error: undefined
}));
var mockUseMutation = jest.fn((callback: (...args: any[]) => void) => {
  return { mutate: (...args: any[]) => callback(...args) };
});
jest.mock("react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useQueryClient: () => ({
    setQueryData: mockSetQueryData
  }),
  useMutation: (callback: () => void) => mockUseMutation(callback),
}));

var mockRootCounter = 0;
var mockOnSnapshot = (callback: (snap: any) => void) => {
  callback(({
    docs: [
      { id: 1, data: () => ({ value: "foo" }) },
      { id: 2, data: () => ({ value: "bar" }) }
    ]
  }));
};
var mockDelete = jest.fn();
var mockGet = jest.fn();
var mockDoc = jest.fn((path: string) => ({
  delete: mockDelete,
  get: mockGet
}));
jest.mock("./use-stores", () => ({
  useDBStore: () => ({
    firestore: {
      getRootFolder: () => ++mockRootCounter % 2 ? "root/" : "root",
      collectionRef: () => ({
        withConverter: (converter: firebase.firestore.FirestoreDataConverter<string>) => {
          // exercise converter
          expect(converter.toFirestore("foo")).toBe("foo");
          expect(converter.fromFirestore({ data: () => "bar" } as any, {})).toBe("bar");
          return {
            onSnapshot: mockOnSnapshot,
            orderBy: () => ({
              onSnapshot: mockOnSnapshot
            })
          };
        }
      }),
      doc: mockDoc
    }
  })
}));

describe("Firestore hooks", () => {

  beforeEach(() => {
    mockUseQuery.mockClear();
    mockSetQueryData.mockClear();
    mockUseMutation.mockClear();
    mockDoc.mockClear();
    mockDelete.mockReset();
    mockGet.mockReset();
  });

  describe("useFirestoreTeacher", () => {
    it("should return teacher records successfully", done => {
      expect.assertions(4);
      const kId = "t1";
      const kDefaultName = "Network User";
      const kRealName = "Jane Teacher";
      const kNetwork = "network";
      const kRealTeacher = { uid: kId, name: kRealName, type: "teacher", network: kNetwork, networks: [kNetwork] };
      const kDefaultTeacher = { ...kRealTeacher, name: kDefaultName };
      mockGet.mockImplementation(() => Promise.resolve({ data: () => kRealTeacher}));
      const { result, rerender } = renderHook(() => useFirestoreTeacher(kId, kNetwork));
      expect(mockGet).toHaveBeenCalledTimes(1);
      // initial response is the default response
      expect(result.current).toEqual(kDefaultTeacher);
      // wait for promise to resolve
      setTimeout(() => {
        rerender();
        // second request for same teacher doesn't hit the network due to caching
        expect(mockGet).toHaveBeenCalledTimes(1);
        // actual teacher available once promise resolves
        expect(result.current).toEqual(kRealTeacher);
        done();
      }, 10);
    });

    it("should return default teacher on error", done => {
      expect.assertions(4);
      const kId = "t2";
      const kDefaultName = "Network User";
      const kRealName = "Jane Teacher";
      const kNetwork = "network";
      const kRealTeacher = { uid: kId, name: kRealName, type: "teacher", network: kNetwork, networks: [kNetwork] };
      const kDefaultTeacher = { ...kRealTeacher, name: kDefaultName };
      mockGet.mockImplementation(() => Promise.reject());
      const { result, rerender } = renderHook(() => useFirestoreTeacher(kId, kNetwork));
      expect(mockGet).toHaveBeenCalledTimes(1);
      // initial response is the default response
      expect(result.current).toEqual(kDefaultTeacher);
      rerender();
      // second request for same teacher doesn't hit the network due to caching
      expect(mockGet).toHaveBeenCalledTimes(1);
      setTimeout(() => {
        // still returns default teacher due to error retrieving real teacher
        expect(result.current).toEqual(kDefaultTeacher);
        done();
      }, 10);
    });
  });

  describe("useCollectionOrderedRealTimeQuery", () => {
    it("should handle empty string", () => {
      renderHook(() => useCollectionOrderedRealTimeQuery(""));
      expect(mockUseQuery.mock.calls[0][0]).toBe("__EMPTY__");
      expect(mockSetQueryData).not.toHaveBeenCalled();
    });

    it("should install onSnapshot handler with default converter", () => {
      renderHook(() => useCollectionOrderedRealTimeQuery("foo"));
      expect(mockSetQueryData).toHaveBeenCalledTimes(1);
      expect(mockSetQueryData.mock.calls[0][0]).toBe("foo");
      expect(mockSetQueryData.mock.calls[0][1]).toEqual(mockData);
      expect(mockUseQuery.mock.calls[0][0]).toBe("foo");
    });

    it("should install onSnapshot handler with default converter and orderBy", () => {
      renderHook(() => useCollectionOrderedRealTimeQuery("bar", { orderBy: "baz" }));
      expect(mockSetQueryData).toHaveBeenCalledTimes(1);
      expect(mockSetQueryData.mock.calls[0][0]).toBe("bar");
      expect(mockSetQueryData.mock.calls[0][1]).toEqual(mockData);
      expect(mockUseQuery.mock.calls[0][0]).toBe("bar");
    });
  });

  describe("useDeleteDocument", () => {
    it("should delete a document", () => {
      const { result } = renderHook(() => useDeleteDocument());
      const docPath = "doc/to/delete";
      result.current.mutate(docPath);
      expect(mockDoc).toHaveBeenCalled();
      expect(mockDoc.mock.calls[0][0]).toBe(docPath);
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
