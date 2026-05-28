import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Modal from "react-modal";
import { ModalProvider } from "react-modal-hook";
import { IModalButton, useCustomModal } from "./use-custom-modal";

// jsdom doesn't implement HTMLSelectElement.showPicker; the modal calls it to
// open a focused select on Enter, so we install a spy to observe that path.
const showPickerMock = jest.fn();

const Content: React.FC<any> = () => (
  <div>
    <select data-testid="select" defaultValue="">
      <option value="">Choose</option>
      <option value="a">A</option>
      <option value="b">B</option>
    </select>
    <textarea data-testid="textarea" />
    <input data-testid="input" />
  </div>
);

interface IHarnessProps {
  onDefaultClick: () => void;
  defaultDisabled?: boolean;
}

const Harness: React.FC<IHarnessProps> = ({ onDefaultClick, defaultDisabled }) => {
  const buttons: IModalButton[] = [
    { label: "Cancel" },
    { label: "Graph It!", isDefault: true, isDisabled: defaultDisabled, onClick: onDefaultClick }
  ];
  const [showModal] = useCustomModal({ className: "test", title: "Test", Content, contentProps: {}, buttons });
  React.useEffect(() => { (showModal as () => void)(); }, [showModal]);
  return <div className="app" />;
};

// react-modal calls onAfterOpen inside a requestAnimationFrame, and the modal's
// keydown listener only attaches once that fires (it needs the content element).
// jsdom's rAF is timer-backed, so flush it (and the post-open focus setTimeout)
// before interacting.
const openModal = async (props: IHarnessProps) => {
  render(<ModalProvider><Harness {...props} /></ModalProvider>);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
};

describe("useCustomModal Enter-key handling", () => {
  beforeAll(() => {
    Modal.setAppElement("body");
    (HTMLSelectElement.prototype as any).showPicker = showPickerMock;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens the select's picker when Enter is pressed on a focused select", async () => {
    await openModal({ onDefaultClick: jest.fn() });
    const select = screen.getByTestId("select");
    select.focus();
    fireEvent.keyDown(select, { key: "Enter" });
    expect(showPickerMock).toHaveBeenCalledTimes(1);
  });

  it("does not submit and keeps the dialog open when Enter is pressed on a focused select", async () => {
    const onDefaultClick = jest.fn();
    await openModal({ onDefaultClick });
    const select = screen.getByTestId("select");
    select.focus();
    fireEvent.keyDown(select, { key: "Enter" });
    expect(onDefaultClick).not.toHaveBeenCalled();
    expect(screen.getByTestId("select")).toBeInTheDocument();
  });

  it("does not fire the default action when Enter is pressed on a focused button", async () => {
    const onDefaultClick = jest.fn();
    await openModal({ onDefaultClick });
    const cancel = screen.getByText("Cancel");
    cancel.focus();
    fireEvent.keyDown(cancel, { key: "Enter" });
    expect(onDefaultClick).not.toHaveBeenCalled();
  });

  it("does not fire the default action when Enter is pressed in a textarea", async () => {
    const onDefaultClick = jest.fn();
    await openModal({ onDefaultClick });
    const textarea = screen.getByTestId("textarea");
    textarea.focus();
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onDefaultClick).not.toHaveBeenCalled();
  });

  it("fires the default action on Enter when focus is on a plain input", async () => {
    const onDefaultClick = jest.fn();
    await openModal({ onDefaultClick });
    const input = screen.getByTestId("input");
    input.focus();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onDefaultClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire the default action on Enter when the default button is disabled", async () => {
    const onDefaultClick = jest.fn();
    await openModal({ onDefaultClick, defaultDisabled: true });
    const input = screen.getByTestId("input");
    input.focus();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onDefaultClick).not.toHaveBeenCalled();
  });
});
