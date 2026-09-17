import { render, screen } from "@testing-library/react";
import React from "react";
import WaitingMessage, { EmptyDocumentNudge } from "./waiting-message";

jest.mock("../../hooks/use-stores", () => ({
  useStores: () => ({
    class: {
      getUserById: () => undefined
    }
  })
}));

// jsdom does not implement scrollIntoView.
window.HTMLElement.prototype.scrollIntoView = jest.fn();

describe("WaitingMessage", () => {
  it("renders nothing when not awaiting a remote comment", () => {
    render(<WaitingMessage content={{ isAwaitingRemoteComment: false } as any} />);
    expect(screen.queryByTestId("comment")).not.toBeInTheDocument();
  });

  it("renders Ada's status message when awaiting a remote comment", () => {
    render(<WaitingMessage content={{ isAwaitingRemoteComment: true } as any} />);
    expect(screen.getByTestId("comment")).toHaveTextContent("Ada is thinking about it...");
  });
});

describe("EmptyDocumentNudge", () => {
  it("renders nothing when there is no nudge", () => {
    render(<EmptyDocumentNudge content={{ emptyDocumentNudge: null } as any} />);
    expect(screen.queryByTestId("comment")).not.toBeInTheDocument();
  });

  it("renders the nudge message when one is set", () => {
    const emptyDocumentNudge = { message: "Add some work to your document before requesting Ideas", shownAt: 1 };
    render(<EmptyDocumentNudge content={{ emptyDocumentNudge } as any} />);
    expect(screen.getByTestId("comment")).toHaveTextContent(emptyDocumentNudge.message);
  });
});

describe("WaitingMessage and EmptyDocumentNudge together", () => {
  it("can both render at once", () => {
    const emptyDocumentNudge = { message: "Add some work to your document before requesting Ideas", shownAt: 1 };
    const content = { isAwaitingRemoteComment: true, emptyDocumentNudge } as any;
    render(
      <>
        <WaitingMessage content={content} />
        <EmptyDocumentNudge content={content} />
      </>
    );
    expect(screen.getByText("Ada is thinking about it...")).toBeInTheDocument();
    expect(screen.getByText(emptyDocumentNudge.message)).toBeInTheDocument();
  });
});
