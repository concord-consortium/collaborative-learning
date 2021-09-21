import firebase from "firebase/app";
import { renderHook } from "@testing-library/react-hooks";
import { useCollectionOrderedRealTimeQuery, useDeleteDocument } from "./firestore-hooks";

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
var mockDocRef = jest.fn((path: string) => ({
  delete: mockDelete
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
      docRef: mockDocRef
    }
  })
}));

describe("Firestore hooks", () => {

  beforeEach(() => {
    mockUseQuery.mockClear();
    mockSetQueryData.mockClear();
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
      expect(mockSetQueryData.mock.calls[0][0]).toBe("root/foo");
      expect(mockSetQueryData.mock.calls[0][1]).toEqual(mockData);
      expect(mockUseQuery.mock.calls[0][0]).toBe("root/foo");
    });

    it("should install onSnapshot handler with default converter and orderBy", () => {
      renderHook(() => useCollectionOrderedRealTimeQuery("bar", { orderBy: "baz" }));
      expect(mockSetQueryData).toHaveBeenCalledTimes(1);
      expect(mockSetQueryData.mock.calls[0][0]).toBe("root/bar");
      expect(mockSetQueryData.mock.calls[0][1]).toEqual(mockData);
      expect(mockUseQuery.mock.calls[0][0]).toBe("root/bar");
    });
  });

  describe("useDeleteDocument", () => {
    it("should delete a document", () => {
      const { result } = renderHook(() => useDeleteDocument());
      const docPath = "doc/to/delete";
      result.current.mutate(docPath);
      expect(mockDocRef).toHaveBeenCalled();
      expect(mockDocRef.mock.calls[0][0]).toBe(docPath);
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
