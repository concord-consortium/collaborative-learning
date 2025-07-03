import { render, screen } from "@testing-library/react";
import React from "react";
import { ModalProvider } from "react-modal-hook";
import { WithId } from "../../hooks/firestore-hooks";
import { CommentDocument } from "../../lib/firestore-schema";
import { UserModelType } from "../../models/stores/user";
import { CommentCard } from "./comment-card";
import { AppConfigModel } from "../../models/stores/app-config-model";
import { unitConfigDefaults } from "../../test-fixtures/sample-unit-configurations";


jest.mock("../../hooks/use-stores", () => ({
  useTypeOfTileInDocumentOrCurriculum: () => "Text",
  useUIStore: () => ({
    showChatPanel: true,
    selectedTileIds: []
  }),
  useStores: () => ({
    appConfig: AppConfigModel.create({ config: unitConfigDefaults })
  }),
  useCurriculumOrDocumentContent: () => undefined
}));

describe("CommentCard", () => {
  const testUser  = { id: "0", name: "Test Teacher" } as UserModelType;
  const activeNavTab = "my-work";

  it("should render successfully", () => {
    render((
      <ModalProvider>
        <CommentCard activeNavTab={activeNavTab} />
      </ModalProvider>
    ));
    expect(screen.getByTestId("comment-card")).toBeInTheDocument();
    expect(screen.getByTestId("comment-card-content")).toBeInTheDocument();
    expect(screen.getByTestId("comment-card-content")).toHaveClass("selected");
  });
  it("should show the correct header icon when there are no comments", () => {
    const postedComments: WithId<CommentDocument>[] = [];
    const commentThread = screen.queryByTestId("comment-thread");
    render((
      <ModalProvider>
        <CommentCard user={testUser} postedComments={postedComments}/>
      </ModalProvider>
    ));
    expect(commentThread).toBeNull();
  });
  it("should show the correct header icon when there are comments and comment appears in card", () => {
    const testComment = "test comment";
    const postedComments: WithId<CommentDocument>[] = [
            { id: "1", uid: "1", name: "T1", createdAt: new Date(), content: testComment }
          ];
    render((
      <ModalProvider>
        <CommentCard user={testUser} postedComments={postedComments}/>
      </ModalProvider>
    ));
    expect(screen.getByTestId("comment-thread")).toBeInTheDocument();
    expect(screen.getByTestId("comment")).toHaveTextContent(testComment);
  });
});
