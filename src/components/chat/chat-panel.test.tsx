import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "mobx-react";
import React from "react";
import { act } from "react-dom/test-utils";
import { ENavTab } from "../../models/view/nav-tabs";
import { ChatPanel } from "./chat-panel";

describe("ChatPanel", () => {

  const stores = { ui: { activeNavTab: ENavTab.kMyWork } };

  it("should render successfully", () => {
    const mockCloseChatPanel = jest.fn();
    render((
      <Provider stores={stores}>
        <ChatPanel newCommentCount={8} onCloseChatPanel={mockCloseChatPanel}/>
      </Provider>
    ));
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
    expect(screen.getByTestId("chat-panel-header")).toBeInTheDocument();

    act(() => {
      userEvent.click(screen.getByTestId("chat-close-button"));
    });
    expect(mockCloseChatPanel).toHaveBeenCalled();
  });
});
