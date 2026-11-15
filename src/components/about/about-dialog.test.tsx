import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "mobx-react";
import Modal from "react-modal";
import { ModalProvider } from "react-modal-hook";
import { AboutDialogContent, getVersionText, useAboutDialog } from "./about-dialog";
import { specStores } from "../../models/stores/spec-stores";

const kParagraph1 = "CLUE is free, open-source software. The CLUE source code is released under the MIT License, " +
  "so you’re welcome to use, modify, and build on it.";
const kParagraph2 = "Your use of CLUE at collaborative-learning.concord.org is governed by our Terms of Use. " +
  "The hosted version is free for non-commercial use; commercial use requires a separate written agreement. " +
  "For more information, visit concord.org/licensing or contact licensing@concord.org.";

describe("getVersionText", () => {
  it("adds the first 7 characters of the sha as the build", () => {
    expect(getVersionText("4.3.0", "0123456789abcdef0123456789abcdef01234567"))
      .toBe("Version 4.3.0 · build 0123456");
  });

  it("shows a short placeholder sha as is", () => {
    expect(getVersionText("4.3.0", "dev")).toBe("Version 4.3.0 · build dev");
  });

  it.each(["", null, undefined])("leaves out the build when the sha is %p", sha => {
    expect(getVersionText("4.3.0", sha)).toBe("Version 4.3.0");
  });
});

describe("AboutDialogContent", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2031-06-01"));
    render(<AboutDialogContent appVersion="4.3.0" gitInfo={{ gitSha: "0123456789abcdef" }} />);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the logo, product line, tagline, version and copyright", () => {
    expect(screen.getByRole("img", { name: "CLUE" })).toBeInTheDocument();
    expect(screen.getByText("a product of The Concord Consortium")).toBeInTheDocument();
    expect(screen.getByText("Collaborative Learning User Environment")).toBeInTheDocument();
    expect(screen.getByTestId("about-dialog-version")).toHaveTextContent(/^Version 4\.3\.0 · build 0123456$/);
    expect(screen.getByText("© 2031 The Concord Consortium, Inc.")).toBeInTheDocument();
  });

  it("shows the license heading and copy", () => {
    expect(screen.getByRole("heading", { name: "License & Terms of Use" })).toBeInTheDocument();
    const paragraphs = Array.from(document.querySelectorAll("p")).map(p => {
      const clone = p.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("a span:not([aria-hidden])").forEach(span => span.remove());
      return clone.textContent;
    });
    expect(paragraphs).toEqual([kParagraph1, kParagraph2]);
  });

  it("links to the license, terms, licensing page, email and source", () => {
    const expected: Array<[string, string]> = [
      ["MIT License", "https://github.com/concord-consortium/collaborative-learning/blob/master/LICENSE"],
      ["Terms of Use", "https://concord.org/terms-of-use/"],
      ["concord.org/licensing", "https://concord.org/licensing"],
      ["licensing@concord.org", "mailto:licensing@concord.org"],
      ["Terms of Use", "https://concord.org/terms-of-use/"],
      ["Licensing details", "https://concord.org/licensing"],
      ["Source on GitHub", "https://github.com/concord-consortium/collaborative-learning"]
    ];
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(expected.length);
    links.forEach((link, i) => {
      const [name, href] = expected[i];
      expect(link).toHaveTextContent(name);
      expect(link).toHaveAttribute("href", href);
      if (href.startsWith("mailto:")) {
        expect(link).not.toHaveAttribute("target");
      } else {
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
      }
    });
  });
});

describe("useAboutDialog", () => {
  const Harness = () => {
    const showAbout = useAboutDialog();
    return <button type="button" onClick={showAbout}>Open</button>;
  };

  // react-modal attaches its handlers and moves focus after an animation frame.
  const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });

  const closeButton = (className: string) => {
    const button = screen.getAllByRole("button", { name: "Close" }).find(b => b.classList.contains(className));
    expect(button).toBeDefined();
    return button!;
  };

  const openDialog = async () => {
    render(
      <Provider stores={specStores({ appVersion: "4.3.0", gitInfo: { gitSha: "fedcba9876543210" } })}>
        <ModalProvider><div className="app"><Harness /></div></ModalProvider>
      </Provider>
    );
    Modal.setAppElement(".app");
    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    fireEvent.click(trigger);
    await flush();
    return trigger;
  };

  it("opens a modal dialog named by its title", async () => {
    await openDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)).toHaveTextContent(/^About CLUE$/);
    expect(screen.getByTestId("about-dialog-version")).toHaveTextContent(/^Version 4\.3\.0 · build fedcba9$/);
  });

  it("closes with the Close button and returns focus to the trigger", async () => {
    const trigger = await openDialog();
    fireEvent.click(closeButton("modal-button"));
    await flush();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes with the × and returns focus to the trigger", async () => {
    const trigger = await openDialog();
    fireEvent.click(closeButton("modal-close"));
    await flush();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes with Escape and returns focus to the trigger", async () => {
    const trigger = await openDialog();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", keyCode: 27 });
    await flush();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
