import React from "react";
import { act, render, screen } from "@testing-library/react";
import { ModalProvider } from "react-modal-hook";
import { NetworkStatus } from "./network-status";
import { UserModel } from "../models/stores/user";

// mock Logger calls
const log = jest.fn();
jest.mock("../lib/logger", () => ({
  ...(jest.requireActual("../lib/logger") as any),
  Logger: {
    log: (...args: any) => log(...args)
  }
}));

describe("NetworkStatus", () => {

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders successfully", () => {

    const user = UserModel.create();

    const jsx = (
            <ModalProvider>
              <NetworkStatus user={user} />
            </ModalProvider>
          );

    const { rerender } = render(jsx);
    expect(screen.getByTestId("network-status")).toBeInTheDocument();
    expect(log).not.toHaveBeenCalled();

    act(() => {
      user.setIsFirebaseConnected(true);
    });
    rerender(jsx);
    expect(screen.getByTestId("network-status")).toBeInTheDocument();
    expect(log).not.toHaveBeenCalled();

    act(() => {
      user.setIsFirebaseConnected(false);
      jest.runAllTimers();
    });
    rerender(jsx);
    expect(screen.getByTestId("network-status")).toBeInTheDocument();
    expect(log).toHaveBeenCalledTimes(1);

    act(() => {
      user.setIsFirebaseConnected(true);
    });
    rerender(jsx);
    expect(screen.getByTestId("network-status")).toBeInTheDocument();
  });
});
