import firebase from "firebase/app";
import { renderHook } from "@testing-library/react-hooks";
import { useCollectionOrderedRealTimeQuery } from "./firestore-hooks";

var mockSetQueryData = jest.fn();
var mockUseQuery = jest.fn((...args) => ({
  isLoading: false,
  isError: false,
  data: ["foo", "bar"],
  error: undefined
}));
jest.mock("react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useQueryClient: () => ({
    setQueryData: mockSetQueryData
  })
}));

var mockRootCounter = 0;
var mockOnSnapshot = (callback: (snap: any) => void) => {
  callback(({
    docs: [
      { data: () => "foo" },
      { data: () => "bar" }
    ]
  }));
};
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
      })
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
      expect(mockSetQueryData.mock.calls[0][1]).toEqual(["foo", "bar"]);
      expect(mockUseQuery.mock.calls[0][0]).toBe("root/foo");
    });

    it("should install onSnapshot handler with default converter and orderBy", () => {
      renderHook(() => useCollectionOrderedRealTimeQuery("bar", { orderBy: "baz" }));
      expect(mockSetQueryData).toHaveBeenCalledTimes(1);
      expect(mockSetQueryData.mock.calls[0][0]).toBe("root/bar");
      expect(mockSetQueryData.mock.calls[0][1]).toEqual(["foo", "bar"]);
      expect(mockUseQuery.mock.calls[0][0]).toBe("root/bar");
    });
  });
});
