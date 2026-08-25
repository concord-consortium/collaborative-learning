import { postContentHeight, postDocumentRendered } from "./iframe-messages";

// jsdom does no layout, so every element reports a scrollHeight of 0. These tests set the
// property directly to stand in for a laid-out page.
function setScrollHeight(element: HTMLElement, height: number) {
  Object.defineProperty(element, "scrollHeight", { configurable: true, value: height });
}

describe("postContentHeight", () => {
  let target: { postMessage: jest.Mock };

  beforeEach(() => {
    target = { postMessage: jest.fn() };
    document.body.innerHTML = `<div id="app"></div>`;
  });

  it("posts the height of the rendered content", () => {
    setScrollHeight(document.getElementById("app")!, 314);

    postContentHeight(target as unknown as Window, document);

    expect(target.postMessage).toHaveBeenCalledTimes(1);
    expect(target.postMessage).toHaveBeenCalledWith({ type: "updateHeight", height: 314 }, "*");
  });

  it("measures the content rather than the body", () => {
    // The bug this guards against: the body has no in-flow content, so its scrollHeight is 0.
    setScrollHeight(document.body, 0);
    setScrollHeight(document.getElementById("app")!, 250);

    postContentHeight(target as unknown as Window, document);

    expect(target.postMessage).toHaveBeenCalledWith({ type: "updateHeight", height: 250 }, "*");
  });

  it("posts nothing when there is no content element", () => {
    document.body.innerHTML = "";

    postContentHeight(target as unknown as Window, document);

    expect(target.postMessage).not.toHaveBeenCalled();
  });
});

describe("postDocumentRendered", () => {
  it("posts the message only once", () => {
    const target = { postMessage: jest.fn() };

    postDocumentRendered(target as unknown as Window);
    postDocumentRendered(target as unknown as Window);
    postDocumentRendered(target as unknown as Window);

    expect(target.postMessage).toHaveBeenCalledTimes(1);
    expect(target.postMessage).toHaveBeenCalledWith({ type: "documentRendered" }, "*");
  });
});
