import { renderHook } from "@testing-library/react-hooks";
import { useUserContext } from "./use-user-context";

jest.mock("./use-stores", () => ({
  useStores: () => ({
    appMode: "test",
    class: {
      users: [
        { id: "1", type: "student" },
        { id: "2", type: "student" },
        { id: "3", type: "teacher" },
        { id: "4", type: "teacher" },
      ]
    },
    demo: { name: "" },
    user: {
      id: "1", portal: "portal", type: "student", name: "Me", teacherNetwork: "", classHash: "class-hash"
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
