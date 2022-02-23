import React from "react";
import { act, render, screen } from "@testing-library/react";
import Modal from "react-modal";
import { ModalProvider } from "react-modal-hook";
import { NetworkStatus } from "./network-status";
import { UserModel } from "../models/stores/user";

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
            <>
              <div className="app"/>
              <ModalProvider>
                <NetworkStatus user={user} />
              </ModalProvider>
            </>
          );

    const { rerender } = render(jsx);
    expect(screen.getByTestId("network-status")).toBeInTheDocument();
    expect(user.networkStatusAlerts).toBe(0);

    act(() => {
      Modal.setAppElement(".app");
      user.setIsFirebaseConnected(true);
    });
    rerender(jsx);
    expect(screen.getByTestId("network-status")).toBeInTheDocument();
    expect(user.networkStatusAlerts).toBe(0);

    act(() => {
      user.setIsFirebaseConnected(false);
      jest.runAllTimers();
    });
    rerender(jsx);
    expect(screen.getByTestId("network-status")).toBeInTheDocument();
    expect(user.networkStatusAlerts).toBe(1);

    act(() => {
      user.setIsFirebaseConnected(true);
    });
    rerender(jsx);
    expect(screen.getByTestId("network-status")).toBeInTheDocument();
  });
});
