import { render, screen } from "@testing-library/react";
import React from "react";
import WaitingMessage, { StatusMessage } from "./waiting-message";

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

describe("StatusMessage", () => {
  it("renders nothing when there is no status message", () => {
    render(<StatusMessage content={{ statusMessage: null } as any} />);
    expect(screen.queryByTestId("comment")).not.toBeInTheDocument();
  });

  it("renders the status message when one is set", () => {
    const statusMessage = { message: "Add some work to your document before requesting Ideas" };
    render(<StatusMessage content={{ statusMessage } as any} />);
    expect(screen.getByTestId("comment")).toHaveTextContent(statusMessage.message);
  });
});

describe("WaitingMessage and StatusMessage together", () => {
  it("can both render at once", () => {
    const statusMessage = { message: "Add some work to your document before requesting Ideas" };
    const content = { isAwaitingRemoteComment: true, statusMessage } as any;
    render(
      <>
        <WaitingMessage content={content} />
        <StatusMessage content={content} />
      </>
    );
    expect(screen.getByText("Ada is thinking about it...")).toBeInTheDocument();
    expect(screen.getByText(statusMessage.message)).toBeInTheDocument();
  });
});
