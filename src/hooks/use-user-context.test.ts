import { renderHook } from "@testing-library/react-hooks";
import { useUserContext } from "./use-user-context";

jest.mock("./use-stores", () => ({
  useStores: () => ({
    userContextProvider: {
      userContext: {
        appMode: "test",
        demoName: "",
        portal: "portal",
        uid: "1",
        type: "student",
        name: "Me",
        classHash: "class-hash",
        teachers: ["3", "4"]
      }
    }
  })
}));

describe("useUserContext", () => {
  it("should return a valid user context", () => {
    const { result } = renderHook(() => useUserContext());
    expect(result.current).toEqual({
      appMode: "test",
      demoName: "",
      portal: "portal",
      uid: "1",
      type: "student",
      name: "Me",
      classHash: "class-hash",
      teachers: ["3", "4"]
    });
  });
});
