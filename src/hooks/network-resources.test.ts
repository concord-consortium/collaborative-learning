import { renderHook } from "@testing-library/react-hooks";
import { INetworkResourceClassResponse } from "../../functions/src/shared";
import { useNetworkResources } from "./network-resources";

var mockGetNetworkResources = jest.fn(() => ({
  data: Promise.resolve({ version: "1.0", response: [] })
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
  });
});
