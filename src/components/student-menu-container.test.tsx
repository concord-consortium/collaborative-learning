import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "mobx-react";
import Modal from "react-modal";
import { ModalProvider } from "react-modal-hook";

import { StudentMenuContainer } from "./student-menu-container";
import { useAboutDialog } from "./about/about-dialog";
import { specStores } from "../models/stores/spec-stores";
import { UserModel } from "../models/stores/user";
import * as authUtils from "../utilities/auth-utils";

// Mock the auth-utils module to track logout URL generation
jest.mock("../utilities/auth-utils", () => ({
  ...jest.requireActual("../utilities/auth-utils"),
  getConfirmLogoutUrl: jest.fn(),
}));

describe("StudentMenuContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders custom select with logout link", async () => {
    const ue = userEvent.setup();
    const user = UserModel.create({
      id: "1",
      name: "Test User"
    });
    const stores = specStores({ user });

    render(
      <Provider stores={stores}>
        <StudentMenuContainer onShowAbout={jest.fn()} />
      </Provider>
    );
    expect(screen.getByTestId("user-header")).toBeInTheDocument();

    await ue.click(screen.getByTestId("user-header"));
    expect(screen.getByTestId("user-list")).toBeInTheDocument();
    expect(screen.getByTestId("list-item-log-out")).not.toHaveAttribute("aria-selected");
    const headerText = screen.getByTestId("user-header").textContent;

    // In Jest 30/jsdom, window.location is non-configurable so we cannot
    // mock location.assign directly. The call to location.assign triggers a
    // jsdom "not implemented" error which we suppress here.
    await jestSpyConsole("error", async () => {
      await ue.click(screen.getByTestId("list-item-log-out"));
    });
    // Verify getConfirmLogoutUrl was called with undefined (no return URL)
    // since user.standaloneAuthUser is not set
    expect(authUtils.getConfirmLogoutUrl).toHaveBeenCalledWith(undefined);
    expect(screen.getByTestId("user-header").textContent).toBe(headerText);
  });

  it("lists About CLUE first, above a divider, and opens it without logging out", async () => {
    const ue = userEvent.setup();
    const onShowAbout = jest.fn();
    const user = UserModel.create({ id: "1", name: "Test User" });

    render(
      <Provider stores={specStores({ user })}>
        <StudentMenuContainer onShowAbout={onShowAbout} />
      </Provider>
    );
    const header = screen.getByTestId("user-header");
    const headerText = header.textContent;

    await ue.click(header);
    const names = screen.getAllByRole("option").map(option => option.textContent);
    expect(names).toHaveLength(2);
    expect(names).toEqual(["About CLUE", "Log Out"]);
    expect(screen.getByTestId("list-item-about-clue")).toHaveClass("bottomBorder");

    await ue.click(screen.getByTestId("list-item-about-clue"));
    expect(onShowAbout).toHaveBeenCalledTimes(1);
    expect(authUtils.getConfirmLogoutUrl).not.toHaveBeenCalled();
    expect(header.textContent).toBe(headerText);
    expect(screen.getByRole("option", { name: "About CLUE" })).not.toHaveAttribute("aria-selected");
  });

  it("returns focus to the menu button when the About dialog closes", async () => {
    const MenuWithDialog = () => {
      const showAbout = useAboutDialog();
      return <StudentMenuContainer onShowAbout={showAbout} />;
    };
    const user = UserModel.create({ id: "1", name: "Test User" });
    render(
      <Provider stores={specStores({ user, appVersion: "4.3.0" })}>
        <ModalProvider><div className="app"><MenuWithDialog /></div></ModalProvider>
      </Provider>
    );
    Modal.setAppElement(".app");
    // useDropdown and react-modal both move focus after an animation frame.
    const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });

    const header = screen.getByTestId("user-header");
    header.focus();
    fireEvent.keyDown(header, { key: "Enter" });
    await flush();
    const about = screen.getByTestId("list-item-about-clue");
    fireEvent.keyDown(about, { key: "Enter" });
    await flush();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", keyCode: 27 });
    await flush();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(header);
  });
});
