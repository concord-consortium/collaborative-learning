import { render, screen } from "@testing-library/react";
import React from "react";
import { ChatThreadToggle } from "./chat-thread-toggle";

describe("Comment Textbox", () => {
  it("Chat toggle expanded", () => {
    const activeNavTab = "problems";
    render((
      <ChatThreadToggle  isThreadExpanded={true} />
    ));
    expect(screen.getByTestId("chat-thread-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("chat-thread-toggle")).toHaveClass("expanded");
  });
  
  it("Chat toggle collapsed", () => {
    const activeNavTab = "problems";
    render((
      <ChatThreadToggle  isThreadExpanded={false} />
    ));
    expect(screen.getByTestId("chat-thread-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("chat-thread-toggle")).not.toHaveClass("expanded");
  });  
});
