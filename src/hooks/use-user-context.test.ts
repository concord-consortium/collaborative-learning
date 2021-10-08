import { renderHook } from "@testing-library/react-hooks";
import { useUserContext } from "./use-user-context";

jest.mock("./use-stores", () => ({
  useAppMode: () => "test",
  useClassStore: () => ({
    users: [
      { id: "1", type: "student" },
      { id: "2", type: "student" },
      { id: "3", type: "teacher" },
      { id: "4", type: "teacher" },
    ]
  }),
  useDemoStore: () => ({ name: "" }),
  useUserStore: () => ({
    id: "1", portal: "portal", type: "student", name: "Me", teacherNetwork: "", classHash: "class-hash"
  })
}));

describe("useUserContext", () => {
  it("should return a valid context", () => {
    const { result } = renderHook(() => useUserContext());
    expect(result.current.appMode).toBe("test");
    expect(result.current.teachers).toEqual(["3", "4"]);
  });
});
