const mockSignInAnonymously = jest.fn();
const mockSetPersistence = jest.fn();
jest.mock("firebase/app", () => {
  const auth: any = () => ({
    setPersistence: mockSetPersistence,
    signInAnonymously: mockSignInAnonymously,
  });
  auth.Auth = { Persistence: { SESSION: "SESSION" } };
  return { auth };
});
const mockInitializeApp = jest.fn();
jest.mock("../../lib/firebase-config", () => ({
  initializeApp: () => mockInitializeApp(),
}));

import { initAdminFirebase } from "./admin-firebase";

describe("initAdminFirebase", () => {
  beforeEach(() => {
    mockInitializeApp.mockClear();
    mockSignInAnonymously.mockReset();
    mockSetPersistence.mockReset();
  });

  it("initializes the app and signs in anonymously", async () => {
    mockSignInAnonymously.mockResolvedValue({});
    await initAdminFirebase();
    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("sets SESSION persistence before signing in", async () => {
    mockSignInAnonymously.mockResolvedValue({});
    await initAdminFirebase();
    expect(mockSetPersistence).toHaveBeenCalledWith("SESSION");
    expect(mockSetPersistence.mock.invocationCallOrder[0])
      .toBeLessThan(mockSignInAnonymously.mock.invocationCallOrder[0]);
  });

  it("propagates sign-in failure", async () => {
    mockSignInAnonymously.mockRejectedValue(new Error("offline"));
    await expect(initAdminFirebase()).rejects.toThrow("offline");
  });
});
