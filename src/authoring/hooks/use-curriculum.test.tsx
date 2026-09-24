import { act, renderHook } from "@testing-library/react";
import { CurriculumProvider, useCurriculum } from "./use-curriculum";

// Two different branches that both happen to have a unit named "X" -- this is what lets a late
// response from one branch be mistaken for the answer to a request from the other, if the guard
// keys only on the unit name.
const branchMetadataFixture = {
  "branch-a": { units: { X: { pulledAt: 0 } } },
  "branch-b": { units: { X: { pulledAt: 0 } } },
};

jest.mock("./use-auth", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    error: null,
    firebaseToken: "fake-firebase-token",
    gitHubToken: "fake-github-token",
    isAdminUser: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    reset: jest.fn(),
  }),
}));

let pendingGets: Array<{ params: Record<string, string>; resolve: (response: any) => void }>;
const mockGet = jest.fn((_endpoint: string, params: Record<string, string>) => {
  return new Promise((resolve) => {
    pendingGets.push({ params, resolve });
  });
});
jest.mock("./use-authoring-api", () => ({
  useAuthoringApi: () => ({ get: mockGet, post: jest.fn() }),
}));

jest.mock("./use-authoring-preview", () => ({
  useAuthoringPreview: () => ({ openPreview: jest.fn(), reloadAllPreviews: jest.fn() }),
}));

jest.mock("firebase/app", () => ({
  database: () => ({
    ref: (path: string) => ({
      on: (_event: string, callback: (snapshot: { val: () => any }) => void) => {
        // Delivers the branch/unit list the moment the provider subscribes, so setBranch/setUnit
        // (which check it) work in this test. The unit-files listener path is not exercised here.
        if (path === "authoring/metadata/branches") {
          callback({ val: () => branchMetadataFixture });
        }
      },
      off: () => undefined,
    }),
  }),
}));

// Resolves the /getContent call for a specific branch/unit/path, in the order the test asks for --
// independent of the order the calls were made in, so a test can simulate responses arriving late.
function resolveGet(branch: string, unit: string, path: string, response: any) {
  const index = pendingGets.findIndex(
    (entry) => entry.params.branch === branch && entry.params.unit === unit && entry.params.path === path
  );
  if (index === -1) {
    throw new Error(`No pending /getContent call for ${branch}/${unit}/${path}`);
  }
  const [found] = pendingGets.splice(index, 1);
  found.resolve(response);
}

describe("CurriculumProvider's stale-fetch guard", () => {
  beforeEach(() => {
    pendingGets = [];
    mockGet.mockClear();
    window.location.hash = "";
  });

  it("does not let a slow response from a previous branch overwrite a later branch " +
    "that reuses the same unit name", async () => {
    const { result } = renderHook(() => useCurriculum(), { wrapper: CurriculumProvider });

    // updateHash (the second argument) matters here: without it, the hash stays empty and a
    // separate effect that keeps state in sync with the hash immediately resets branch/unit back
    // to nothing, the same as it would if the address bar disagreed with these calls.
    act(() => result.current.setBranch("branch-a", true));
    act(() => result.current.setUnit("X", true));
    // branch-a/X's two /getContent calls are now pending and deliberately left unresolved.

    act(() => result.current.setBranch("branch-b", true));
    act(() => result.current.setUnit("X", true));
    // branch-b/X's two /getContent calls are now pending too.

    expect(pendingGets).toHaveLength(4);

    // The newer branch's response arrives first.
    await act(async () => {
      resolveGet("branch-b", "X", "content.json", { success: true, content: { marker: "branch-b" } });
      resolveGet(
        "branch-b", "X", "teacher-guide/content.json", { success: true, content: { marker: "branch-b-guide" } }
      );
      await Promise.resolve();
    });

    // The older branch's slow response finally arrives after.
    await act(async () => {
      resolveGet("branch-a", "X", "content.json", { success: true, content: { marker: "branch-a" } });
      resolveGet(
        "branch-a", "X", "teacher-guide/content.json", { success: true, content: { marker: "branch-a-guide" } }
      );
      await Promise.resolve();
    });

    expect(result.current.unitConfig).toEqual({ marker: "branch-b" });
    expect(result.current.teacherGuideConfig).toEqual({ marker: "branch-b-guide" });
    expect(result.current.unitConfigLoading).toBe(false);
  });
});
