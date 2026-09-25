import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { EntryStatus, gImageMap, ImageMapEntry } from "../models/image-map";
import { useLazyImage } from "./use-lazy-image";

const kCcImgUrl = "ccimg://fbrtdb.concord.org/classhash123/imagekey456";
const kBlobUrl = "blob:http://localhost/abc-123";

const readyEntry = () => ImageMapEntry.create({
  contentUrl: kCcImgUrl, displayUrl: kBlobUrl, retries: 0, status: EntryStatus.Ready
});

// Mirrors how a real consumer uses the hook: the ref is attached to rendered markup, so React
// populates it before effects run.
const Consumer = ({ url }: { url: string }) => {
  const { ref, displayUrl } = useLazyImage(url);
  return <div ref={ref} data-testid="holder">{displayUrl}</div>;
};

// Captures observers so a test can decide when the element becomes visible. Honors
// disconnect(), so a hook that fails to disconnect will visibly fetch more than once.
interface IFakeObserver { callback: IntersectionObserverCallback; connected: boolean }

function installObserver() {
  const observers: IFakeObserver[] = [];
  (global as any).IntersectionObserver = class {
    private entry: IFakeObserver;
    observe = jest.fn();
    unobserve = jest.fn();
    constructor(callback: IntersectionObserverCallback) {
      this.entry = { callback, connected: true };
      observers.push(this.entry);
    }
    disconnect() { this.entry.connected = false; }
  };
  return observers;
}

const scrollIntoView = (observers: IFakeObserver[]) => act(() => {
  const observer = observers[observers.length - 1];
  if (observer.connected) observer.callback([{ isIntersecting: true } as any], {} as any);
});

describe("useLazyImage", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as any).IntersectionObserver;
  });

  it("does not fetch an off-screen image", () => {
    installObserver();
    const getImage = jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry());

    render(<Consumer url={kCcImgUrl} />);

    expect(getImage).not.toHaveBeenCalled();
    expect(screen.getByTestId("holder")).toHaveTextContent("");
  });

  it("fetches once the element scrolls into view", async () => {
    const observers = installObserver();
    const getImage = jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry());

    render(<Consumer url={kCcImgUrl} />);
    scrollIntoView(observers);

    await waitFor(() => expect(getImage).toHaveBeenCalledWith(kCcImgUrl));
    await waitFor(() => expect(screen.getByTestId("holder")).toHaveTextContent(kBlobUrl));
  });

  it("fetches only once even if the observer reports visibility repeatedly", async () => {
    const observers = installObserver();
    const getImage = jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry());

    render(<Consumer url={kCcImgUrl} />);
    scrollIntoView(observers);
    scrollIntoView(observers);

    await waitFor(() => expect(getImage).toHaveBeenCalledTimes(1));
  });

  it("ignores values that are not image references", () => {
    installObserver();
    const getImage = jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry());

    render(<Consumer url="just some text" />);

    expect(getImage).not.toHaveBeenCalled();
  });

  it("fetches eagerly where IntersectionObserver is unavailable", async () => {
    const getImage = jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry());

    render(<Consumer url={kCcImgUrl} />);

    await waitFor(() => expect(getImage).toHaveBeenCalledWith(kCcImgUrl));
    await waitFor(() => expect(screen.getByTestId("holder")).toHaveTextContent(kBlobUrl));
  });
});
