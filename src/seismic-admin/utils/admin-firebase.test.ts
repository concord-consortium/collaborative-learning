const mockSignInAnonymously = jest.fn();
jest.mock("firebase/app", () => ({
  auth: () => ({ signInAnonymously: mockSignInAnonymously }),
}));
const mockInitializeApp = jest.fn();
jest.mock("../../lib/firebase-config", () => ({
  initializeApp: () => mockInitializeApp(),
}));

import { initAdminFirebase } from "./admin-firebase";

describe("initAdminFirebase", () => {
  beforeEach(() => { mockInitializeApp.mockClear(); mockSignInAnonymously.mockReset(); });

  it("initializes the app and signs in anonymously", async () => {
    mockSignInAnonymously.mockResolvedValue({});
    await initAdminFirebase();
    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("propagates sign-in failure", async () => {
    mockSignInAnonymously.mockRejectedValue(new Error("offline"));
    await expect(initAdminFirebase()).rejects.toThrow("offline");
  });
});
