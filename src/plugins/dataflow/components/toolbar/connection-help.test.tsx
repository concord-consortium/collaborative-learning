import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { runInAction } from "mobx";
import { destroy } from "mobx-state-tree";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";
import { TileModelContext } from "../../../../components/tiles/tile-api";
import { getToolbarButtonInfo } from "../../../../components/toolbar/toolbar-button-manager";
import { LogEventName } from "../../../../lib/logger-types";
import { SerialDevice } from "../../../../models/stores/serial";
import { specStores } from "../../../../models/stores/spec-stores";
import { logTileChangeEvent } from "../../../../models/tiles/log/log-tile-change-event";
import { TileModel } from "../../../../models/tiles/tile-model";
import { IConnectFailure, kHelpSuccessLine } from "../../model/connect-failures";
import { ConnectionAttempt } from "../../model/connection-attempt";
import { DataflowContentModel } from "../../model/dataflow-content";
import { getDeviceConnection } from "../../model/device-connection";
import { openConnectionHelp } from "./connection-help";
import "../../dataflow-toolbar-registration";
import "../../dataflow-registration";

jest.mock("../../../../models/tiles/log/log-tile-change-event", () => ({ logTileChangeEvent: jest.fn() }));

const openFailed: IConnectFailure = {
  attemptId: "attempt-1", kind: "openFailed", choice: "arduino", step: "open", elapsedMs: 1200
};

const noData: IConnectFailure = {
  attemptId: "attempt-2", kind: "noData", choice: "arduino", step: "waitForData", elapsedMs: 5000
};

const fakeTransport = () => ({
  close: jest.fn(), write: jest.fn(), onData: undefined, onDisconnect: undefined
}) as unknown as Parameters<SerialDevice["setActiveDevice"]>[1];

function helpEvents(operation: string) {
  return jest.mocked(logTileChangeEvent).mock.calls
    .filter(([, params]) => params.operation === operation)
    .map(([event, params]) => ({ event, tileId: params.tileId, change: params.change }));
}

type Stores = ReturnType<typeof specStores>;

// A Dataflow tile's connect button. Tiles rendered with the same stores share one connection.
function renderTile(stores: Stores) {
  const content = DataflowContentModel.create();
  const model = TileModel.create({ content });
  const ConnectButton = getToolbarButtonInfo("dataflow", "connect")!.component;
  const result = render(
    <ModalProvider>
      <Provider stores={stores}>
        <TileModelContext.Provider value={model}>
          <ConnectButton name="connect" />
        </TileModelContext.Provider>
      </Provider>
    </ModalProvider>
  );
  const trigger = () => result.container.querySelector<HTMLButtonElement>("button.toolbar-button.connect")!;
  return { ...result, content, model, trigger };
}

// A tile whose connect attempt failed with `failure`, its palette open.
function renderFailedTile(failure = openFailed) {
  const stores = specStores();
  const connection = getDeviceConnection(stores.serialDevice);
  const tile = renderTile(stores);
  act(() => {
    runInAction(() => {
      connection.lastChoice = failure.choice;
      connection.lastFailure = failure;
    });
    tile.content.setConnectFailure(failure);
  });
  fireEvent.click(tile.trigger());
  return { ...tile, stores, connection };
}

// A tile whose Arduino is open but sends nothing, with the help for that showing in its palette.
function renderStalledTile() {
  const stores = specStores();
  const connection = getDeviceConnection(stores.serialDevice);
  const tile = renderTile(stores);
  act(() => {
    stores.serialDevice.setActiveDevice("arduino", fakeTransport());
    runInAction(() => {
      connection.lastChoice = noData.choice;
      connection.lastFailure = noData;
    });
    tile.content.setConnectFailure(noData);
  });
  fireEvent.click(tile.trigger());
  act(() => openConnectionHelp(connection, connection.helpTopic("noData", tile.model.id)!));
  return { ...tile, stores, connection };
}

// Records a stall on a tile that showed another problem, with the Arduino open as the stall needs.
function stallOnArduino(r: ReturnType<typeof renderFailedTile>) {
  const attempt = new ConnectionAttempt("arduino", "connect");
  const stall = { ...noData, attemptId: attempt.id };
  act(() => {
    r.stores.serialDevice.setActiveDevice("arduino", fakeTransport());
    runInAction(() => {
      attempt.opened("waitForData");
      attempt.end("noData", stall);
      r.connection.attempt = attempt;
      r.connection.lastFailure = stall;
    });
    r.content.setConnectFailure(stall);
  });
}

type Rendered = ReturnType<typeof renderStalledTile>;

// The stalled Arduino starts sending data.
function startData(r: Pick<Rendered, "connection" | "stores">) {
  act(() => runInAction(() => {
    r.connection.lastFailure = undefined;
    r.stores.serialDevice.markDataReceived();
  }));
}

const palette = () => screen.getByRole("group", { name: "Device connection" });
const region = () => screen.getByRole("region", { name: "Connection help" });
const help = () => screen.getByRole("button", { name: "Help" });
const press = (key: string) => fireEvent.keyDown(document.activeElement as Element, { key });

describe("ConnectionHelp", () => {
  beforeEach(() => jest.mocked(logTileChangeEvent).mockClear());

  it("Help opens the column with the headline, tries and collapsed Details, focuses its header and logs", () => {
    const { model } = renderFailedTile();
    expect(screen.queryByRole("region", { name: "Connection help" })).toBeNull();
    fireEvent.click(help());
    expect(region()).toBeInTheDocument();
    expect(palette()).toContainElement(region());
    expect(palette()).toHaveClass("with-help");
    expect(document.activeElement).toHaveTextContent("Connection help");
    expect(document.activeElement).toHaveClass("connection-help-title");
    expect(within(region()).getByText("The browser couldn't open the Arduino.")).toBeInTheDocument();
    expect(within(region()).getByText(kHelpSuccessLine)).toBeInTheDocument();
    const tries = within(region()).getAllByRole("listitem");
    expect(tries.map(t => t.textContent)).toEqual([
      "Unplug the Arduino, plug it back in, and click Connect.",
      "Still not working? Reload this page, then click Connect."
    ]);
    expect(within(tries[1]).getByText("Still not working?").tagName).toBe("EM");
    // The palette's own status lines aren't repeated in the help.
    expect(within(region()).queryByText("Not connected")).toBeNull();
    expect(within(region()).queryByText("Couldn't open it.")).toBeNull();
    expect(within(region()).getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "false");
    expect(within(region()).queryByText("Step: open.")).toBeNull();
    expect(helpEvents("showConnectHelp")).toEqual([{
      event: LogEventName.DATAFLOW_TOOL_CHANGE, tileId: model.id,
      change: { targetType: "connectHelp", kind: "openFailed" }
    }]);
  });

  it("Details expands and collapses with aria-expanded", () => {
    renderFailedTile();
    fireEvent.click(help());
    const details = within(region()).getByRole("button", { name: "Details" });
    act(() => details.focus());
    fireEvent.click(details);
    expect(details).toHaveAttribute("aria-expanded", "true");
    expect(document.activeElement).toBe(details);
    const text = within(region()).getByText("Step: open.");
    expect(details).toHaveAttribute("aria-controls", text.id);
    fireEvent.keyDown(details, { key: "Enter" });
    expect(details).toHaveAttribute("aria-expanded", "false");
    expect(within(region()).queryByText("Step: open.")).toBeNull();
  });

  it("Help is disabled with a title while its problem's help shows, and clicking it does nothing", () => {
    renderFailedTile();
    expect(help()).not.toHaveAttribute("title");
    fireEvent.click(help());
    expect(help()).toHaveAttribute("aria-disabled", "true");
    expect(help()).toHaveAttribute("title", "This problem's help is showing.");
    fireEvent.click(help());
    fireEvent.keyDown(help(), { key: "Enter" });
    expect(helpEvents("showConnectHelp")).toHaveLength(1);
  });

  it("✕ closes the column, keeps the palette open, focuses Help and logs hideConnectHelp", () => {
    const { connection, model } = renderFailedTile();
    fireEvent.click(help());
    fireEvent.click(within(region()).getByRole("button", { name: "Close connection help" }));
    expect(screen.queryByRole("region", { name: "Connection help" })).toBeNull();
    expect(connection.help).toBeUndefined();
    expect(palette()).toBeInTheDocument();
    expect(palette()).not.toHaveClass("with-help");
    expect(document.activeElement).toBe(help());
    expect(help()).not.toHaveAttribute("aria-disabled");
    expect(helpEvents("hideConnectHelp")).toEqual([{
      event: LogEventName.DATAFLOW_TOOL_CHANGE, tileId: model.id,
      change: { targetType: "connectHelp", kind: "openFailed", trigger: "close" }
    }]);
  });

  it("✕ focuses the palette's first control when no Help shows", () => {
    const { content } = renderFailedTile();
    fireEvent.click(help());
    act(() => content.setConnectFailure(undefined));
    expect(within(palette()).queryByRole("button", { name: "Help" })).toBeNull();
    fireEvent.keyDown(within(region()).getByRole("button", { name: "Close connection help" }), { key: "Enter" });
    expect(screen.queryByRole("region", { name: "Connection help" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Connect Arduino" }));
  });

  it("the column's controls follow the palette's in arrow-key order", () => {
    renderFailedTile();
    fireEvent.click(help());
    const close = within(region()).getByRole("button", { name: "Close connection help" });
    const details = within(region()).getByRole("button", { name: "Details" });
    press("End");
    expect(document.activeElement).toBe(details);
    press("Home");
    expect(document.activeElement).toBe(help());
    press("ArrowUp");
    expect(document.activeElement).toBe(details);
    act(() => screen.getByRole("button", { name: "Connect Spiker:bit" }).focus());
    press("ArrowDown");
    expect(document.activeElement).toBe(close);
    press("ArrowDown");
    expect(document.activeElement).toBe(details);
  });

  it("a palette opened with help already showing focuses its first control, not the help's header", () => {
    const a = renderFailedTile();
    fireEvent.click(help());
    press("Escape");
    expect(a.content.connectPaletteOpen).toBe(false);
    const b = renderTile(a.stores);
    fireEvent.click(b.trigger());
    expect(region()).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Connect Arduino" }));
  });

  it("Close help closes the help, logs the notice and hideConnectHelp, and focuses the palette's first control", () => {
    const r = renderStalledTile();
    startData(r);
    const notice = within(region()).getByRole("status");
    expect(notice).toHaveTextContent("It's working now. The Arduino is sending data.");
    expect(within(notice).getByText("It's working now.").tagName).toBe("STRONG");
    expect(within(region()).getByText("The Arduino isn't sending anything.").closest(".connection-help-steps"))
      .toHaveClass("faded");
    expect(helpEvents("connectHelpNotice")).toEqual([expect.objectContaining({
      tileId: r.model.id, change: { targetType: "connectHelp", notice: "working", action: "shown" }
    })]);

    fireEvent.click(within(notice).getByRole("button", { name: "Close help" }));
    expect(screen.queryByRole("region", { name: "Connection help" })).toBeNull();
    expect(r.connection.help).toBeUndefined();
    expect(palette()).toBeInTheDocument();
    expect(document.activeElement).toBe(palette().querySelector("[role='button']"));
    expect(helpEvents("connectHelpNotice")[1]).toEqual(expect.objectContaining({
      change: { targetType: "connectHelp", notice: "working", action: "clicked" }
    }));
    expect(helpEvents("hideConnectHelp")).toEqual([expect.objectContaining({
      tileId: r.model.id, change: { targetType: "connectHelp", kind: "noData", trigger: "closeHelp" }
    })]);
    act(() => r.stores.serialDevice.clearActiveDevice());
  });

  it("Show steps for this replaces the steps, focuses the title and logs connectHelpNotice clicked", () => {
    const r = renderFailedTile();
    fireEvent.click(help());
    stallOnArduino(r);
    const notice = within(region()).getByRole("status");
    expect(notice).toHaveTextContent("Something else went wrong: the Arduino isn't sending anything.");
    expect(within(region()).getByText("The browser couldn't open the Arduino.").closest(".connection-help-steps"))
      .not.toHaveClass("faded");

    fireEvent.click(within(notice).getByRole("button", { name: "Show steps for this" }));
    expect(within(region()).getByRole("status")).toBeEmptyDOMElement();
    expect(within(region()).queryByText("The browser couldn't open the Arduino.")).toBeNull();
    expect(within(region()).getByText("The Arduino isn't sending anything.")).toBeInTheDocument();
    expect(within(region()).getAllByRole("listitem")[0]).toHaveTextContent("Click Reconnect.");
    expect(document.activeElement).toHaveClass("connection-help-title");
    expect(helpEvents("connectHelpNotice")).toEqual([
      expect.objectContaining({
        change: { targetType: "connectHelp", notice: "differentProblem", kind: "noData", action: "shown" }
      }),
      expect.objectContaining({
        tileId: r.model.id,
        change: { targetType: "connectHelp", notice: "differentProblem", kind: "noData", action: "clicked" }
      })
    ]);
    act(() => r.stores.serialDevice.clearActiveDevice());
  });

  it("Help next to a different problem replaces the help and clears the notice", () => {
    const r = renderFailedTile();
    fireEvent.click(help());
    stallOnArduino(r);
    expect(within(region()).getByText(/Something else went wrong/)).toBeInTheDocument();
    expect(within(palette()).getByText("No data yet.")).toBeInTheDocument();
    expect(help()).not.toHaveAttribute("aria-disabled");
    fireEvent.click(help());
    expect(within(region()).getByText("The Arduino isn't sending anything.")).toBeInTheDocument();
    expect(within(region()).queryByText(/Something else went wrong/)).toBeNull();
    act(() => r.stores.serialDevice.clearActiveDevice());
  });

  it("an unplug or a disconnect shows what to do next, and leaves the steps as they were", () => {
    const r = renderStalledTile();
    act(() => runInAction(() => {
      r.connection.lastFailure = undefined;
      r.stores.serialDevice.clearActiveDevice("unplugged");
    }));
    const notice = within(region()).getByRole("status");
    expect(notice).toHaveTextContent("The Arduino was unplugged. Plug it back in and click Connect.");
    expect(within(notice).getByText("The Arduino was unplugged.").tagName).toBe("STRONG");
    expect(within(notice).queryByRole("button")).toBeNull();
    expect(within(region()).getByText("The Arduino isn't sending anything.").closest(".connection-help-steps"))
      .not.toHaveClass("faded");

    act(() => r.stores.serialDevice.clearLastLoss());
    expect(notice).toHaveTextContent("The Arduino isn't connected. Click Connect to try again.");
    expect(helpEvents("connectHelpNotice")).toEqual([
      expect.objectContaining({
        tileId: r.model.id, change: { targetType: "connectHelp", notice: "unplugged", action: "shown" }
      }),
      expect.objectContaining({
        tileId: r.model.id, change: { targetType: "connectHelp", notice: "notConnected", action: "shown" }
      })
    ]);
  });

  it("keeps working when the tile that opened it is deleted", () => {
    const r = renderStalledTile();
    const tileId = r.model.id;
    destroy(r.model);
    r.unmount();
    startData(r);

    const b = renderTile(r.stores);
    fireEvent.click(b.trigger());
    expect(within(region()).getByRole("status")).toHaveTextContent("It's working now.");
    fireEvent.click(within(region()).getByRole("button", { name: "Close help" }));
    expect(r.connection.help).toBeUndefined();
    expect(helpEvents("hideConnectHelp")).toEqual([expect.objectContaining({ tileId })]);
    act(() => r.stores.serialDevice.clearActiveDevice());
  });

  it("the help stays when the palette closes by Escape, outside click or the connect button, and shows again", () => {
    const r = renderFailedTile();
    fireEvent.click(help());
    const closers: Array<() => void> = [
      () => press("Escape"),
      () => fireEvent.pointerDown(document.body),
      () => fireEvent.click(r.trigger())
    ];
    closers.forEach(close => {
      close();
      expect(r.content.connectPaletteOpen).toBe(false);
      expect(screen.queryByRole("region", { name: "Connection help" })).toBeNull();
      fireEvent.click(r.trigger());
      expect(within(region()).getByText("The browser couldn't open the Arduino.")).toBeInTheDocument();
      expect(document.activeElement).toBe(palette().querySelector("[role='button']"));
      expect(document.activeElement).not.toHaveClass("connection-help-title");
    });
    expect(r.connection.help).toBeDefined();
    expect(helpEvents("hideConnectHelp")).toEqual([]);
  });

  it("a notice that appears while the palette is closed is there when it opens", () => {
    const r = renderStalledTile();
    press("Escape");
    expect(screen.queryByRole("region", { name: "Connection help" })).toBeNull();
    startData(r);
    fireEvent.click(r.trigger());
    expect(within(region()).getByText("It's working now.")).toBeInTheDocument();
    act(() => r.stores.serialDevice.clearActiveDevice());
  });

  it("another tile's palette shows the same help, and ✕ there closes it for both", () => {
    const a = renderFailedTile();
    fireEvent.click(help());
    press("Escape");
    const b = renderTile(a.stores);
    fireEvent.click(b.trigger());
    expect(within(region()).getByText("The browser couldn't open the Arduino.")).toBeInTheDocument();
    fireEvent.click(within(region()).getByRole("button", { name: "Close connection help" }));
    expect(a.connection.help).toBeUndefined();
    expect(helpEvents("hideConnectHelp")).toHaveLength(1);
  });
});
