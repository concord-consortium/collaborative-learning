import React, { useRef } from "react";
import { observer } from "mobx-react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { UIModel, UIModelType } from "../../models/stores/ui";
import { LearningLogWorkspace } from "../../models/stores/workspace";
import { RightDrawer } from "../../components/right-drawer/right-drawer";
import { ChatTutorLauncher, useCloseChatTutor } from "./chat-tutor-launcher";

let mockUi: UIModelType;
jest.mock("../../hooks/use-stores", () => ({ useStores: () => ({ ui: mockUi }) }));

const Panel: React.FC<{ onClose: () => void }> = () => <div>Panel body</div>;
const panel = { id: "help", tabLabel: "Connection help", Component: Panel };

const Harness = observer(function Harness() {
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeAda = useCloseChatTutor(launcherRef);
  return (
    <>
      <ChatTutorLauncher ref={launcherRef} />
      <RightDrawer chatTutorAvailable={true}
                   renderChatTutor={() => <button onClick={closeAda}>Close Ada</button>} />
    </>
  );
});

describe("ChatTutorLauncher", () => {
  beforeEach(() => {
    mockUi = UIModel.create({ learningLogWorkspace: { type: LearningLogWorkspace, mode: "1-up" } });
  });

  it("hides the AIdeas launcher whenever the drawer is open, whichever tab is showing", () => {
    render(<Harness />);
    const launcher = () => screen.getByTestId("chat-tutor-launcher");
    expect(launcher()).toBeVisible();

    act(() => mockUi.setShowChatTutor(true));
    expect(launcher()).not.toBeVisible();

    act(() => mockUi.openDrawerPanel(panel));
    expect(launcher()).not.toBeVisible();
    act(() => mockUi.setDrawerTab("chatTutor"));
    expect(launcher()).not.toBeVisible();

    act(() => { mockUi.setShowChatTutor(false); mockUi.closeDrawerPanel(); });
    expect(launcher()).toBeVisible();

    act(() => mockUi.openDrawerPanel(panel));
    expect(launcher()).not.toBeVisible();
  });

  it("focuses the panel's tab when Ada closes while a panel stays open", () => {
    render(<Harness />);
    act(() => { mockUi.setShowChatTutor(true); mockUi.openDrawerPanel(panel); });
    fireEvent.click(screen.getByRole("button", { name: "Ada" }));
    fireEvent.click(screen.getByText("Close Ada"));
    expect(screen.getByRole("button", { name: "Connection help" })).toHaveFocus();
  });

  it("focuses the launcher when Ada closes and the drawer closes entirely", () => {
    render(<Harness />);
    act(() => mockUi.setShowChatTutor(true));
    fireEvent.click(screen.getByText("Close Ada"));
    expect(screen.getByTestId("chat-tutor-launcher")).toHaveFocus();
  });
});
