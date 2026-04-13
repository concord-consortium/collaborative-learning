import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Modal from "react-modal";
import { ModalProvider } from "react-modal-hook";
import { LinkDialogContent, useLinkDialog } from "./use-link-dialog";
import type { LinkDisplayMode } from "../../../../models/tiles/text/text-content";
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
    displayMode: "link" as LinkDisplayMode,
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

describe("useLinkDialog hook", () => {
  const mockLogTileChangeEvent = logTileChangeEvent as jest.Mock;
  const mockSetNodes = Transforms.setNodes as jest.Mock;
  const mockWrapNodes = Transforms.wrapNodes as jest.Mock;
  const mockUnwrapNodes = Transforms.unwrapNodes as jest.Mock;

  const mockTextContent = {
    getLinkDisplayMode: jest.fn(),
    setLinkDisplayMode: jest.fn(),
    removeLinkDisplayMode: jest.fn(),
  };

  beforeAll(() => {
    Modal.setAppElement("body");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTextContent.getLinkDisplayMode.mockReturnValue("link");
  });

  interface ITestWrapperProps {
    tileId?: string;
    selectedLink?: any;
    textContent?: any;
  }
  const TestWrapper: React.FC<ITestWrapperProps> = ({
    tileId, selectedLink, textContent = mockTextContent
  }) => {
    const editor = {} as any;
    const [showModal] = useLinkDialog({
      editor, selectedLink, text: "test", tileId, textContent
    });
    React.useEffect(() => { (showModal as () => void)(); }, [showModal]);
    return <div className="app" />;
  };

  it("logs TEXT_LINK_DISPLAY_CHANGE when Button radio is clicked (with tileId)", () => {
    render(<ModalProvider><TestWrapper tileId="test-tile-id" /></ModalProvider>);
    fireEvent.click(screen.getByLabelText("Button"));
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
    render(<ModalProvider><TestWrapper /></ModalProvider>);
    fireEvent.click(screen.getByLabelText("Button"));
    expect(mockLogTileChangeEvent).not.toHaveBeenCalled();
  });

  it("Save for a new link calls wrapNodes with linkId and no displayMode", () => {
    render(<ModalProvider><TestWrapper tileId="t1" /></ModalProvider>);
    const urlInput = screen.getByPlaceholderText("URL");
    fireEvent.change(urlInput, { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByLabelText("Button"));
    fireEvent.click(screen.getByText("Save"));

    expect(mockWrapNodes).toHaveBeenCalled();
    const wrapNodesCall = mockWrapNodes.mock.calls[0];
    const element = wrapNodesCall[1];
    expect(element).toEqual(expect.objectContaining({
      type: "link",
      href: "https://example.com",
      linkId: expect.any(String)
    }));
    expect(element).not.toHaveProperty("displayMode");
    expect(element.linkId.length).toBeGreaterThan(0);

    expect(mockTextContent.setLinkDisplayMode).toHaveBeenCalledWith(
      element.linkId,
      "button"
    );
  });

  it("Save for a new link with 'link' mode still generates linkId and calls setLinkDisplayMode", () => {
    render(<ModalProvider><TestWrapper tileId="t1" /></ModalProvider>);
    fireEvent.change(screen.getByPlaceholderText("URL"), { target: { value: "https://x.com" } });
    fireEvent.click(screen.getByText("Save"));

    expect(mockWrapNodes).toHaveBeenCalled();
    const element = mockWrapNodes.mock.calls[0][1];
    expect(element).not.toHaveProperty("displayMode");
    expect(mockTextContent.setLinkDisplayMode).toHaveBeenCalledWith(
      element.linkId,
      "link"
    );
  });

  it("Save for an existing link preserves linkId and writes displayMode to model", () => {
    const existingLink = { type: "link", href: "https://old.com", linkId: "fixed-id" };
    render(<ModalProvider><TestWrapper tileId="t1" selectedLink={existingLink} /></ModalProvider>);
    fireEvent.click(screen.getByLabelText("Button"));
    fireEvent.click(screen.getByText("Save"));

    expect(mockSetNodes).toHaveBeenCalled();
    const setNodesElement = mockSetNodes.mock.calls[0][1];
    expect(setNodesElement).toEqual(expect.objectContaining({
      href: "https://old.com",
      linkId: "fixed-id"
    }));
    expect(setNodesElement).not.toHaveProperty("displayMode");
    expect(mockTextContent.setLinkDisplayMode).toHaveBeenCalledWith("fixed-id", "button");
    expect(mockWrapNodes).not.toHaveBeenCalled();
  });

  it("Save for an existing link strips legacy displayMode field from slate payload", () => {
    const legacyLink = {
      type: "link",
      href: "https://old.com",
      linkId: "legacy-id",
      displayMode: "button"
    };
    render(<ModalProvider><TestWrapper tileId="t1" selectedLink={legacyLink} /></ModalProvider>);
    fireEvent.click(screen.getByText("Save"));

    const setNodesElement = mockSetNodes.mock.calls[0][1];
    expect(setNodesElement).not.toHaveProperty("displayMode");
  });

  it("Save with empty URL unwraps the link and removes display mode entry", () => {
    const existingLink = { type: "link", href: "https://old.com", linkId: "to-delete" };
    render(<ModalProvider><TestWrapper tileId="t1" selectedLink={existingLink} /></ModalProvider>);
    fireEvent.change(screen.getByPlaceholderText("URL"), { target: { value: "" } });
    fireEvent.click(screen.getByText("Save"));

    expect(mockUnwrapNodes).toHaveBeenCalled();
    expect(mockTextContent.removeLinkDisplayMode).toHaveBeenCalledWith("to-delete");
    expect(mockSetNodes).not.toHaveBeenCalled();
  });

  it("initial displayMode state reads from textContent.getLinkDisplayMode", () => {
    const existingLink = { type: "link", href: "https://x.com", linkId: "pre-button-id" };
    mockTextContent.getLinkDisplayMode.mockReturnValue("button");
    render(<ModalProvider><TestWrapper tileId="t1" selectedLink={existingLink} /></ModalProvider>);
    expect(mockTextContent.getLinkDisplayMode).toHaveBeenCalledWith("pre-button-id");
    const buttonRadio = screen.getByLabelText("Button") as HTMLInputElement;
    expect(buttonRadio.checked).toBe(true);
  });
});
