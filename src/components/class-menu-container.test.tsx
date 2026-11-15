import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { Provider } from "mobx-react";

import { ClassMenuContainer } from "./class-menu-container";
import { specStores } from "../models/stores/spec-stores";
import { IStandaloneAuthUser, UserModel } from "../models/stores/user";

// The offerings' unit and ordinal give the problem path specStores() reports (NULL/0/0),
// which is what ClassMenuContainer matches classes against.
const offering = (className: string, offeringId: string) => ({
  className, offeringId, unitCode: "NULL", problemOrdinal: "0.0", location: `https://example.com/${offeringId}`
});

function renderMenu(options: { offerings?: boolean, standalone?: boolean } = {}) {
  const user = UserModel.create({
    id: "1",
    type: "teacher",
    name: "Test Teacher",
    className: "Class 1",
    portalClassOfferings: options.offerings ? [offering("Class 1", "1"), offering("Class 2", "2")] : []
  });
  if (options.standalone) {
    user.setStandaloneAuthUser({ rawJWT: "", jwt: {}, classId: 1, offeringId: 1 } as IStandaloneAuthUser);
  }
  const onShowAbout = jest.fn();
  render(
    <Provider stores={specStores({ user })}>
      <ClassMenuContainer onShowAbout={onShowAbout} />
    </Provider>
  );
  return onShowAbout;
}

// useDropdown moves focus to the selected option after an animation frame.
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });

const openMenu = async () => {
  fireEvent.click(screen.getByTestId("custom-select-header"));
  await flush();
};

const optionNames = () => screen.getAllByRole("option").map(option => option.textContent);

describe("ClassMenuContainer", () => {
  it("lists About CLUE above the classes and keeps the class selected after opening it", async () => {
    const onShowAbout = renderMenu({ offerings: true });
    await openMenu();
    const names = optionNames();
    expect(names).toHaveLength(3);
    expect(names).toEqual(["About CLUE", "Class 1", "Class 2"]);
    expect(screen.getByTestId("list-item-about-clue")).toHaveClass("bottomBorder");

    fireEvent.click(screen.getByTestId("list-item-about-clue"));
    expect(onShowAbout).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("option", { name: "Class 1" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "About CLUE" })).not.toHaveAttribute("aria-selected");

    await openMenu();
    expect(document.activeElement).toBe(screen.getByRole("option", { name: "Class 1" }));
  });

  it("still offers About CLUE when there are no classes", async () => {
    renderMenu();
    expect(screen.getByTestId("custom-select-header")).not.toHaveClass("disabled");
    await openMenu();
    expect(optionNames()).toEqual(["About CLUE"]);
  });

  it("puts About CLUE before the standalone actions", async () => {
    renderMenu({ offerings: true, standalone: true });
    await openMenu();
    const names = optionNames();
    expect(names).toHaveLength(5);
    expect(names).toEqual(["About CLUE", "Copy Shareable Link", "Log Out", "Class 1", "Class 2"]);
  });
});
