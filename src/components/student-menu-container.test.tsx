import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "mobx-react";

import { StudentMenuContainer } from "./student-menu-container";
import { specStores } from "../models/stores/spec-stores";
import { UserModel } from "../models/stores/user";
import * as authUtils from "../utilities/auth-utils";

// Mock the auth-utils module to track logout URL generation
jest.mock("../utilities/auth-utils", () => ({
  ...jest.requireActual("../utilities/auth-utils"),
  getConfirmLogoutUrl: jest.fn(),
}));

describe("StudentMenuContainer", () => {

  it("renders custom select with logout link", async () => {
    const user = UserModel.create({
      id: "1",
      name: "Test User"
    });
    const stores = specStores({ user });

    render(
      <Provider stores={stores}>
        <StudentMenuContainer />
      </Provider>
    );
    expect(screen.getByTestId("user-header")).toBeInTheDocument();

    act(() => {
      userEvent.click(screen.getByTestId("user-header"));
    });
    expect(screen.getByTestId("user-list")).toBeInTheDocument();
    expect(screen.getByTestId("list-item-log-out")).toBeInTheDocument();

    // In Jest 30/jsdom 25, window.location is non-configurable so we cannot
    // mock location.assign directly. The call to location.assign triggers a
    // jsdom "not implemented" error which we suppress here.
    await jestSpyConsole("error", () => {
      act(() => {
        userEvent.click(screen.getByTestId("list-item-log-out"));
      });
    });
    // Verify getConfirmLogoutUrl was called with undefined (no return URL)
    // since user.standaloneAuthUser is not set
    expect(authUtils.getConfirmLogoutUrl).toHaveBeenCalledWith(undefined);
  });
});
