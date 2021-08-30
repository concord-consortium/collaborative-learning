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
    data: [
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 1" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 2" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 3" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 4" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 5" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 6" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 7" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 8" }
    ],
    error: undefined
  }),
  useUnreadDocumentComments: () => ({
    isLoading: false,
    isError: false,
    data: [
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 6" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 7" },
      { uid: "1", name: "Teacher 1", createdAt: new Date(), content: "Comment 8" }
    ],
    error: undefined
  }),
  usePostDocumentComment: () => ({
    mutate: () => mockPostComment()
  })
}));

jest.mock("../../hooks/use-stores", () => ({
  useDocumentOrCurriculumMetadata: (documentKey: string) => ({
    uid: "1", key: documentKey, type: "problem"
  })
}));

describe("ChatPanel", () => {

  it("should render successfully", () => {
    const mockCloseChatPanel = jest.fn();
    render((
      <ChatPanel activeNavTab={ENavTab.kMyWork} documentKey="document-key" onCloseChatPanel={mockCloseChatPanel}/>
    ));
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
    expect(screen.getByTestId("chat-panel-header")).toBeInTheDocument();

    act(() => {
      userEvent.click(screen.getByTestId("chat-close-button"));
    });
    expect(mockCloseChatPanel).toHaveBeenCalled();
  });

  it("should allow user to type text in the textarea and click Post button", () => {
    const mockCloseChatPanel = jest.fn();
    const { rerender } = render((
      <ChatPanel activeNavTab={ENavTab.kMyWork} documentKey="document-key" onCloseChatPanel={mockCloseChatPanel}/>
    ));
    const postButton = screen.getByTestId("comment-post-button");
    const textarea = screen.getByTestId("comment-textarea") as HTMLTextAreaElement;
    const text = "X"; //testing library issue when typing in more than one character
    expect(postButton).toHaveClass("disabled");
    act(() =>{
      userEvent.type(textarea, text);
    });
    rerender(
      <ChatPanel activeNavTab={ENavTab.kMyWork} documentKey="document-key" onCloseChatPanel={mockCloseChatPanel}/>
    );
    expect(textarea.value).toBe(text);
    expect(postButton).not.toHaveClass("disabled");
    act(() => {
      userEvent.click(postButton);
    });
    expect(textarea.value).toBe("");
    expect(postButton).toHaveClass("disabled");
  });
});
