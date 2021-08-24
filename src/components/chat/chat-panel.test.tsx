import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ENavTab } from "../../models/view/nav-tabs";
import { ChatPanel } from "./chat-panel";

const mockPostComment = jest.fn();

jest.mock("../../hooks/document-comment-hooks", () => ({
  useDocumentComments: () => ({
    isLoading: false,
    isError: false,
    data: {
      docs: [
        { data: () => ({ uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 1"}) },
        { data: () => ({ uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 2"}) },
        { data: () => ({ uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 3"}) },
        { data: () => ({ uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 4"}) },
        { data: () => ({ uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 5"}) },
        { data: () => ({ uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 6"}) },
        { data: () => ({ uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 7"}) },
        { data: () => ({ uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 8"}) },
      ]
    },
    error: undefined
  }),
  usePostDocumentComment: () => ({
    mutate: () => mockPostComment()
  })
}));

describe("ChatPanel", () => {

  it("should render successfully", () => {
    const mockCloseChatPanel = jest.fn();
    const mockDocument = { key: "document-key" } as any;
    render((
      <ChatPanel activeNavTab={ENavTab.kMyWork} document={mockDocument} onCloseChatPanel={mockCloseChatPanel}/>
    ));
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
    expect(screen.getByTestId("chat-panel-header")).toBeInTheDocument();

    act(() => {
      userEvent.click(screen.getByTestId("chat-close-button"));
    });
    expect(mockCloseChatPanel).toHaveBeenCalled();
  });
});
