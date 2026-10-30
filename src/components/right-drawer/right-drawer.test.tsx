import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { UIModel, UIModelType } from "../../models/stores/ui";
import { LearningLogWorkspace } from "../../models/stores/workspace";
import { RightDrawer } from "./right-drawer";

let mockUi: UIModelType;
jest.mock("../../hooks/use-stores", () => ({ useStores: () => ({ ui: mockUi }) }));

const Panel: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div data-testid="panel-content">
    Panel body
    <button onClick={onClose}>Close panel</button>
  </div>
);

const panel = { id: "help", tabLabel: "Connection help", Component: Panel };

let adaMounts = 0;
const AdaProbe: React.FC = () => {
  React.useEffect(() => { adaMounts++; }, []);
  return <div data-testid="ada-content">Ada</div>;
};
const renderChatTutor = () => <AdaProbe />;

describe("RightDrawer", () => {
  beforeEach(() => {
    adaMounts = 0;
    mockUi = UIModel.create({ learningLogWorkspace: { type: LearningLogWorkspace, mode: "1-up" } });
  });

  it("renders nothing while nothing is open", () => {
    const { container } = render(<RightDrawer chatTutorAvailable={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows only the panel when Ada isn't available", () => {
    render(<RightDrawer chatTutorAvailable={false} />);
    act(() => mockUi.openDrawerPanel(panel));
    expect(screen.getByTestId("panel-content")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ada" })).not.toBeInTheDocument();
  });

  it("shows Ada and panel tabs when Ada is available, and keeps Ada mounted on the panel tab", () => {
    render(<RightDrawer chatTutorAvailable={true} renderChatTutor={renderChatTutor} />);
    act(() => mockUi.setShowChatTutor(true));
    // Ada alone: no tabs
    expect(screen.queryByRole("button", { name: "Ada" })).not.toBeInTheDocument();
    expect(screen.getByTestId("ada-content")).toBeVisible();

    act(() => mockUi.openDrawerPanel(panel));
    // Two toggle buttons, not a tab list: the selected one is pressed.
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    const ada = screen.getByRole("button", { name: "Ada" });
    const help = screen.getByRole("button", { name: "Connection help" });
    expect(help).toHaveAttribute("aria-pressed", "true");
    expect(ada).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("panel-content")).toBeVisible();
    // still mounted (so the conversation is kept) but hidden
    expect(screen.getByTestId("ada-content")).not.toBeVisible();

    fireEvent.click(ada);
    expect(ada).toHaveAttribute("aria-pressed", "true");
    expect(help).toHaveAttribute("aria-pressed", "false");
    expect(mockUi.drawerTab).toBe("chatTutor");
    expect(screen.getByTestId("ada-content")).toBeVisible();
    expect(screen.queryByTestId("panel-content")).not.toBeInTheDocument();
    expect(adaMounts).toBe(1);
  });

  it("clicking Ada's tab opens Ada when only the panel was open", () => {
    render(<RightDrawer chatTutorAvailable={true} renderChatTutor={renderChatTutor} />);
    act(() => mockUi.openDrawerPanel(panel));
    expect(screen.queryByTestId("ada-content")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ada" }));
    expect(mockUi.showChatTutor).toBe(true);
    expect(mockUi.drawerTab).toBe("chatTutor");
    expect(screen.getByTestId("ada-content")).toBeVisible();
  });

  it("closing Ada while her tab is selected shows the panel", () => {
    render(<RightDrawer chatTutorAvailable={true} renderChatTutor={renderChatTutor} />);
    act(() => { mockUi.setShowChatTutor(true); mockUi.openDrawerPanel(panel); });
    fireEvent.click(screen.getByRole("button", { name: "Ada" }));
    expect(screen.queryByTestId("panel-content")).not.toBeInTheDocument();

    act(() => mockUi.setShowChatTutor(false));
    expect(screen.queryByTestId("ada-content")).not.toBeInTheDocument();
    expect(screen.getByTestId("panel-content")).toBeVisible();
    expect(screen.getByRole("button", { name: "Connection help" })).toHaveAttribute("aria-pressed", "true");
  });

  it("tells Ada she is active only while her tab is showing", () => {
    const activeValues: boolean[] = [];
    const recordActive = (active: boolean) => {
      activeValues.push(active);
      return <AdaProbe />;
    };
    render(<RightDrawer chatTutorAvailable={true} renderChatTutor={recordActive} />);
    act(() => mockUi.setShowChatTutor(true));
    expect(activeValues[activeValues.length - 1]).toBe(true);

    act(() => mockUi.openDrawerPanel(panel));
    expect(activeValues[activeValues.length - 1]).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Ada" }));
    expect(activeValues[activeValues.length - 1]).toBe(true);
  });

  it("gives Ada the toggle buttons' row for her focus trap", () => {
    let tabsRef: React.RefObject<HTMLDivElement> | undefined;
    const recordTabsRef = (_active: boolean, ref: React.RefObject<HTMLDivElement>) => {
      tabsRef = ref;
      return <AdaProbe />;
    };
    render(<RightDrawer chatTutorAvailable={true} renderChatTutor={recordTabsRef} />);
    act(() => { mockUi.setShowChatTutor(true); mockUi.openDrawerPanel(panel); });
    expect(tabsRef?.current).toContainElement(screen.getByRole("button", { name: "Ada" }));
  });

  it("closing the panel leaves Ada showing if Ada was open, and closes the drawer otherwise", () => {
    render(<RightDrawer chatTutorAvailable={true} renderChatTutor={renderChatTutor} />);
    act(() => { mockUi.setShowChatTutor(true); mockUi.openDrawerPanel(panel); });
    fireEvent.click(screen.getByText("Close panel"));
    expect(screen.queryByTestId("panel-content")).not.toBeInTheDocument();
    expect(screen.getByTestId("ada-content")).toBeVisible();
    expect(mockUi.isRightDrawerOpen).toBe(true);

    act(() => { mockUi.setShowChatTutor(false); mockUi.openDrawerPanel(panel); });
    expect(screen.getByTestId("panel-content")).toBeVisible();
    fireEvent.click(screen.getByText("Close panel"));
    expect(mockUi.isRightDrawerOpen).toBe(false);
    expect(screen.queryByTestId("panel-content")).not.toBeInTheDocument();
  });

  it("reports the drawer open whenever Ada or a panel is open", () => {
    expect(mockUi.isRightDrawerOpen).toBe(false);
    mockUi.openDrawerPanel(panel);
    expect(mockUi.isRightDrawerOpen).toBe(true);
    mockUi.closeDrawerPanel();
    mockUi.setShowChatTutor(true);
    expect(mockUi.isRightDrawerOpen).toBe(true);
  });
});
