const DELETE_SENTINEL = { _type: "FieldValue.delete" };

jest.mock("firebase/app", () => ({
  __esModule: true,
  default: {
    firestore: {
      FieldValue: {
        delete: () => DELETE_SENTINEL
      }
    }
  }
}));

const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn().mockReturnValue({ update: mockUpdate });

jest.mock("./firestore-hooks", () => ({
  useFirestore: () => [{ doc: mockDoc }]
}));

jest.mock("./use-user-context", () => ({
  useUserContext: () => ({ uid: "user1" })
}));

import { renderHook, act } from "@testing-library/react-hooks";
import { useUpdateCommentRating } from "./use-update-comment-rating";

describe("useUpdateCommentRating", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets a rating on a comment", async () => {
    const { result } = renderHook(() => useUpdateCommentRating());
    await act(async () => {
      await result.current("documents/doc1/comments/comment1", "yes");
    });
    expect(mockDoc).toHaveBeenCalledWith("documents/doc1/comments/comment1");
    expect(mockUpdate).toHaveBeenCalledWith({ "ratings.user1": "yes" });
  });

  it("removes a rating when value is undefined", async () => {
    const { result } = renderHook(() => useUpdateCommentRating());
    await act(async () => {
      await result.current("documents/doc1/comments/comment1", undefined);
    });
    expect(mockDoc).toHaveBeenCalledWith("documents/doc1/comments/comment1");
    expect(mockUpdate).toHaveBeenCalledWith({
      "ratings.user1": DELETE_SENTINEL
    });
  });

  it("replaces an existing rating with a different value", async () => {
    const { result } = renderHook(() => useUpdateCommentRating());
    await act(async () => {
      await result.current("documents/doc1/comments/comment1", "no");
    });
    expect(mockUpdate).toHaveBeenCalledWith({ "ratings.user1": "no" });
  });
});
