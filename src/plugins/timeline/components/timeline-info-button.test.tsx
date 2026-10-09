import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import Modal from "react-modal";
import { ModalProvider } from "react-modal-hook";
import { TimelineInfoButton } from "./timeline-info-button";

describe("TimelineInfoButton", () => {
  // The modal portals into the body and hides the app element from assistive technology, so the
  // app element can't be the body itself.
  let appElt: HTMLDivElement;
  beforeEach(() => {
    appElt = document.createElement("div");
    document.body.append(appElt);
    Modal.setAppElement(appElt);
  });

  const renderButton = () => render(<ModalProvider><TimelineInfoButton /></ModalProvider>, { container: appElt });

  // react-modal finishes opening in a requestAnimationFrame, which jsdom backs with a timer.
  const clickInfoButton = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Zooming and Moving" }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
  };

  const openModal = async () => {
    renderButton();
    await clickInfoButton();
  };

  it("opens the Zooming and Moving modal", async () => {
    renderButton();
    expect(screen.getByRole("button", { name: "Zooming and Moving" })).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await clickInfoButton();
    const dialog = screen.getByRole("dialog", { name: "Zooming and Moving" });
    expect(dialog).toHaveTextContent("shift+click to zoom back out");
    expect(dialog).toHaveTextContent("click+hold+drag the graph");
    expect(dialog).toHaveTextContent("The Full Timeline below the graph");
    expect(dialog).toHaveAccessibleDescription(/^Zoom in and out with the Zoom In and Zoom Out buttons\./);
  });

  it("focuses the OK button when it opens", async () => {
    await openModal();
    expect(screen.getByRole("button", { name: "OK" })).toHaveFocus();
  });

  it("closes with the OK button", async () => {
    await openModal();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes with the close button", async () => {
    await openModal();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes with Escape", async () => {
    await openModal();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", keyCode: 27 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
