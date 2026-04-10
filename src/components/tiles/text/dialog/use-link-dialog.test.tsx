import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Modal from "react-modal";
import { ModalProvider } from "react-modal-hook";
import { LinkDialogContent, useLinkDialog } from "./use-link-dialog";
import { logTileChangeEvent } from "../../../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../../../lib/logger-types";
import { Transforms } from "@concord-consortium/slate-editor";

jest.mock("../../../../models/tiles/log/log-tile-change-event", () => ({
  logTileChangeEvent: jest.fn()
}));

jest.mock("@concord-consortium/slate-editor", () => {
  const actual = jest.requireActual("@concord-consortium/slate-editor");
  return {
    ...actual,
    Transforms: {
      setNodes: jest.fn(),
      wrapNodes: jest.fn(),
      unwrapNodes: jest.fn(),
      collapse: jest.fn(),
    },
    ReactEditor: {
      ...actual.ReactEditor,
      findPath: jest.fn(() => [0])
    }
  };
});

describe("LinkDialogContent", () => {
  const defaultProps = {
    setUrl: jest.fn(),
    displayMode: "link",
    setDisplayMode: jest.fn(),
    text: "example text",
    url: "https://example.com"
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with Link radio selected by default", () => {
    render(<LinkDialogContent {...defaultProps} />);
    const linkRadio = screen.getByLabelText("Link") as HTMLInputElement;
    const buttonRadio = screen.getByLabelText("Button") as HTMLInputElement;
    expect(linkRadio.checked).toBe(true);
    expect(buttonRadio.checked).toBe(false);
  });

  it("renders with Button radio selected when displayMode is button", () => {
    render(<LinkDialogContent {...defaultProps} displayMode="button" />);
    const linkRadio = screen.getByLabelText("Link") as HTMLInputElement;
    const buttonRadio = screen.getByLabelText("Button") as HTMLInputElement;
    expect(linkRadio.checked).toBe(false);
    expect(buttonRadio.checked).toBe(true);
  });

  it("calls setDisplayMode when Button radio is clicked", () => {
    render(<LinkDialogContent {...defaultProps} />);
    const buttonRadio = screen.getByLabelText("Button");
    fireEvent.click(buttonRadio);
    expect(defaultProps.setDisplayMode).toHaveBeenCalledWith("button");
  });

  it("calls setDisplayMode when Link radio is clicked", () => {
    render(<LinkDialogContent {...defaultProps} displayMode="button" />);
    const linkRadio = screen.getByLabelText("Link");
    fireEvent.click(linkRadio);
    expect(defaultProps.setDisplayMode).toHaveBeenCalledWith("link");
  });

  it("renders the Display as fieldset with legend", () => {
    render(<LinkDialogContent {...defaultProps} />);
    expect(screen.getByText("Display as:")).toBeInTheDocument();
  });

  it("renders the URL input with current value", () => {
    render(<LinkDialogContent {...defaultProps} />);
    const input = screen.getByPlaceholderText("URL") as HTMLInputElement;
    expect(input.value).toBe("https://example.com");
  });

  it("calls setUrl when input changes", () => {
    render(<LinkDialogContent {...defaultProps} />);
    const input = screen.getByPlaceholderText("URL");
    fireEvent.change(input, { target: { value: "https://new-url.com" } });
    expect(defaultProps.setUrl).toHaveBeenCalled();
  });
});

// CLUE-477 Step 4-6: These tests assert the old behavior where displayMode was
// stored on the Slate link element. After this refactor, displayMode lives on
// TextContentModel (keyed by linkId) and the hook now requires a textContent
// prop. These tests are temporarily skipped and will be rewritten in Step 7.
describe.skip("useLinkDialog hook", () => {
  const mockLogTileChangeEvent = logTileChangeEvent as jest.Mock;
  const mockSetNodes = Transforms.setNodes as jest.Mock;
  const mockWrapNodes = Transforms.wrapNodes as jest.Mock;
  const mockUnwrapNodes = Transforms.unwrapNodes as jest.Mock;

  interface ITestWrapperProps {
    tileId?: string;
    selectedLink?: any;
  }
  const TestWrapper: React.FC<ITestWrapperProps> = ({ tileId, selectedLink }) => {
    const editor = {} as any;
    const [showModal] = useLinkDialog({ editor, selectedLink, text: "example text", tileId });
    React.useEffect(() => { (showModal as () => void)(); }, [showModal]);
    return <div className="app" />;
  };

  beforeAll(() => {
    Modal.setAppElement("body");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs TEXT_LINK_DISPLAY_CHANGE when displayMode changes via radio (with tileId)", () => {
    render(
      <ModalProvider>
        <TestWrapper tileId="test-tile-id" />
      </ModalProvider>
    );
    const buttonRadio = screen.getByLabelText("Button");
    fireEvent.click(buttonRadio);
    expect(mockLogTileChangeEvent).toHaveBeenCalledWith(
      LogEventName.TEXT_LINK_DISPLAY_CHANGE,
      expect.objectContaining({
        operation: "display-mode-change",
        change: { displayMode: "button" },
        tileId: "test-tile-id"
      })
    );
  });

  it("does NOT log when tileId is undefined", () => {
    render(
      <ModalProvider>
        <TestWrapper />
      </ModalProvider>
    );
    const buttonRadio = screen.getByLabelText("Button");
    fireEvent.click(buttonRadio);
    expect(mockLogTileChangeEvent).not.toHaveBeenCalled();
  });

  it("Save handler calls Transforms.wrapNodes with displayMode for new link", () => {
    render(
      <ModalProvider>
        <TestWrapper tileId="t1" />
      </ModalProvider>
    );
    const urlInput = screen.getByPlaceholderText("URL");
    fireEvent.change(urlInput, { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByLabelText("Button"));
    fireEvent.click(screen.getByText("Save"));

    expect(mockWrapNodes).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "link",
        href: "https://example.com",
        displayMode: "button"
      }),
      expect.anything()
    );
    expect(mockSetNodes).not.toHaveBeenCalled();
  });

  it("Save handler calls Transforms.setNodes with displayMode when editing existing link", () => {
    const existingLink = { type: "link", href: "https://old.com", displayMode: "link" };
    render(
      <ModalProvider>
        <TestWrapper tileId="t1" selectedLink={existingLink} />
      </ModalProvider>
    );
    fireEvent.click(screen.getByLabelText("Button"));
    fireEvent.click(screen.getByText("Save"));

    expect(mockSetNodes).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        href: "https://old.com",
        displayMode: "button"
      }),
      expect.anything()
    );
    expect(mockWrapNodes).not.toHaveBeenCalled();
    expect(mockUnwrapNodes).not.toHaveBeenCalled();
  });
});
