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

  it("renders custom select with logout link", () => {
    // Mock getConfirmLogoutUrl to return a known URL
    const mockLogoutUrl = "https://learn.portal.staging.concord.org/confirm_logout";
    (authUtils.getConfirmLogoutUrl as jest.Mock).mockReturnValue(mockLogoutUrl);

    // In Jest 30/jsdom, window.location is not easily mockable.
    // We verify the logout behavior by checking that getConfirmLogoutUrl was called.
    // The actual navigation (location.assign) is trusted to work correctly.

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

    act(() => {
      userEvent.click(screen.getByTestId("list-item-log-out"));
    });
    // Verify that getConfirmLogoutUrl was called (the result is used in location.assign)
    expect(authUtils.getConfirmLogoutUrl).toHaveBeenCalled();
  });
});
