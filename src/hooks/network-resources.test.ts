import { renderHook } from "@testing-library/react-hooks";
import { INetworkResourceClassResponse } from "../../functions/src/shared";
import { useNetworkResources } from "./network-resources";

var mockGetNetworkResources = jest.fn(() => Promise.resolve({
  data: { version: "1.0", response: [] as any }
}));
var mockHttpsCallable = jest.fn((fn: string) => {
  switch(fn) {
    case "getNetworkResources_v1":
      return mockGetNetworkResources;
  }
});
jest.mock("firebase/app", () => ({
  functions: () => ({
    httpsCallable: (fn: string) => mockHttpsCallable(fn)
  })
}));

var mockData: INetworkResourceClassResponse[] = [];
var mockUseQuery = jest.fn(async (key: string, fn: () => Promise<INetworkResourceClassResponse[]>) => {
  await fn();
  return {
    isLoading: false,
    isError: false,
    data: mockData,
    error: undefined
  };
});
jest.mock("react-query", () => ({
  useQuery: (key: string, fn: () => Promise<INetworkResourceClassResponse[]>) => {
    mockUseQuery(key, fn);
  }
}));

var mockAddDocument = jest.fn();
jest.mock("./use-stores", () => ({
  useNetworkDocuments: () => ({ add: mockAddDocument }),
  useProblemPath: () => "abc/1/2"
}));
jest.mock("./use-user-context", () => ({
  useUserContext: () => ({ appMode: "test", classHash: "class-hash" })
}));

describe("Network resources hooks", () => {
  describe("useNetworkResources", () => {
    it("should render the hook", () => {
      renderHook(() => useNetworkResources());
      expect(mockGetNetworkResources).toHaveBeenCalled();
    });
    it("should process the results of the hook", () => {
      mockGetNetworkResources.mockImplementation(() => {
        return Promise.resolve({
          data: {
            version: "1.0",
            response: [{
              context_id: "class-hash",
              personalPublications: {
                "pub-2-meta": {
                  self: { documentKey: "pub-2" }, uid: "user-1", title: "title", properties: {}, originDoc: "personal-1"
                }
              },
              learningLogPublications: {
                "log-2-meta": {
                  self: { documentKey: "log-2" }, uid: "user-1", title: "title", properties: {}, originDoc: "log-1"
                }
              },
              teachers: [{
                uid: "user-1",
                personalDocuments: {
                  "document-1": { self: { uid: "user-1", documentKey: "document-1" }, title: "title", properties: {} }
                },
                learningLogs: {
                  "log-1": { self: { uid: "user-1", documentKey: "log-1" }, title: "log", properties: {} }
                },
              }],
              resources: [{
                problemPublications: {
                  "pub-1-meta": { documentKey: "pub-1", userId: "user-1" }
                },
                teachers: [{
                  uid: "user-1",
                  problemDocuments: {
                    "problem-1": { self: { uid: "user-1" }, documentKey: "problem-1", visibility: "public" }
                  },
                  planningDocuments: {
                    "planning-1": { self: { uid: "user-1" }, documentKey: "planning-1", visibility: "private" }
                  }
                }, {  // should handle documents with invalid metadata
                  uid: "user-2",
                  problemDocuments: {
                    "problem-2": { visibility: "public" }
                  },
                  planningDocuments: {
                    "planning-2": { visibility: "private" }
                  }
                }]
              }]
            }]
          }
        });
      });
      jestSpyConsole("warn", async (mockConsoleFn, mockRestore) => {
        await renderHook(() => useNetworkResources());
        expect(mockConsoleFn).toHaveBeenCalledTimes(2);
        mockRestore();
      }, { asyncRestore: true });
      expect(mockGetNetworkResources).toHaveBeenCalled();
    });
  });
});
