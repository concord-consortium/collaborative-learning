import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "mobx-react";

import { StudentMenuContainer } from "./student-menu-container";
import { specStores } from "../models/stores/spec-stores";
import { UserModel } from "../models/stores/user";

describe("StudentMenuContainer", () => {

  it("renders custom select with logout link", () => {
    const originalLocation = window.location;
    delete (window as any).location;
    const assignFn = jest.fn();
    (window as any).location = {
      assign: assignFn,
      pathname: "/",
    };

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
    expect(assignFn).toHaveBeenCalledWith("https://learn.portal.staging.concord.org/confirm_logout");

    (window as any).location = originalLocation;
  });
});
