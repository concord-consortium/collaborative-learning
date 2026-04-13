import React from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { ReactEditor } from "@concord-consortium/slate-editor";
import { LinkComponent } from "./link-plugin";
import { TextContentModel } from "../../models/tiles/text/text-content";
import { TextContentModelContext } from "../../components/tiles/text/text-content-context";

jest.mock("@concord-consortium/slate-editor", () => {
  const actual = jest.requireActual("@concord-consortium/slate-editor");
  return {
    ...actual,
    useSelected: jest.fn(() => false),
    useSlate: jest.fn(() => ({})),
    registerElementComponent: jest.fn(),
    ReactEditor: {
      ...actual.ReactEditor,
      isReadOnly: jest.fn(() => false),
    },
  };
});

describe("LinkComponent", () => {
  const originalOpen = window.open;

  beforeEach(() => {
    jest.clearAllMocks();
    (ReactEditor.isReadOnly as jest.Mock).mockReturnValue(false);
    (window as any).open = jest.fn();
  });

  afterAll(() => {
    (window as any).open = originalOpen;
  });

  const makeTextContent = () => TextContentModel.create();

  const renderLink = ({
    linkId = "L1",
    href = "https://example.com",
    textContent = makeTextContent(),
    readOnly = false,
  }: {
    linkId?: string;
    href?: string;
    textContent?: any;
    readOnly?: boolean;
  } = {}) => {
    (ReactEditor.isReadOnly as jest.Mock).mockReturnValue(readOnly);
    const element: any = { type: "link", href, linkId, children: [{ text: "" }] };
    const attributes: any = { ref: jest.fn(), "data-slate-node": "element" };
    const utils = render(
      <TextContentModelContext.Provider value={textContent}>
        <LinkComponent attributes={attributes} element={element}>
          <span>click me</span>
        </LinkComponent>
      </TextContentModelContext.Provider>
    );
    return { ...utils, textContent };
  };

  it("renders in link mode by default", () => {
    const { container } = renderLink();
    const anchor = container.querySelector("a");
    expect(anchor).toBeInTheDocument();
    expect(anchor?.className).toContain("link-mode");
    expect(anchor?.className).not.toContain("button-mode");
  });

  it("renders in button mode when textContent says so", () => {
    const textContent = makeTextContent();
    textContent.setLinkDisplayMode("L1", "button");
    const { container } = renderLink({ textContent });
    const anchor = container.querySelector("a");
    expect(anchor?.className).toContain("button-mode");
    expect(anchor?.getAttribute("contenteditable")).toBe("false");
  });

  it("clicking in editable link mode without modifier does nothing", () => {
    const { container } = renderLink();
    const anchor = container.querySelector("a")!;
    fireEvent.click(anchor);
    expect(window.open).not.toHaveBeenCalled();
  });

  it("cmd/ctrl-click in editable link mode opens URL in new tab", () => {
    const { container } = renderLink();
    const anchor = container.querySelector("a")!;
    fireEvent.click(anchor, { metaKey: true });
    expect(window.open).toHaveBeenCalledWith(
      "https://example.com", "_blank", "noopener,noreferrer"
    );
  });

  it("clicking in read-only mode opens URL even without modifier", () => {
    const { container } = renderLink({ readOnly: true });
    const anchor = container.querySelector("a")!;
    fireEvent.click(anchor);
    expect(window.open).toHaveBeenCalledWith(
      "https://example.com", "_blank", "noopener,noreferrer"
    );
  });

  it("clicking in button mode opens URL in editable mode", () => {
    const textContent = makeTextContent();
    textContent.setLinkDisplayMode("L1", "button");
    const { container } = renderLink({ textContent });
    const anchor = container.querySelector("a")!;
    fireEvent.click(anchor);
    expect(window.open).toHaveBeenCalledWith(
      "https://example.com", "_blank", "noopener,noreferrer"
    );
  });

  it("applies read-only class when in read-only mode", () => {
    const { container } = renderLink({ readOnly: true });
    const anchor = container.querySelector("a");
    expect(anchor?.className).toContain("read-only");
  });

  it("re-renders when textContent.setLinkDisplayMode changes the mode (MobX reactivity)", () => {
    const textContent = makeTextContent();
    const { container } = renderLink({ textContent });
    let anchor = container.querySelector("a");
    expect(anchor?.className).toContain("link-mode");

    act(() => { textContent.setLinkDisplayMode("L1", "button"); });

    anchor = container.querySelector("a");
    expect(anchor?.className).toContain("button-mode");
  });
});
