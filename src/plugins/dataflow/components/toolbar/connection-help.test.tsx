import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { runInAction } from "mobx";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";
import { TileModelContext } from "../../../../components/tiles/tile-api";
import { getToolbarButtonInfo } from "../../../../components/toolbar/toolbar-button-manager";
import { LogEventName } from "../../../../lib/logger-types";
import { specStores } from "../../../../models/stores/spec-stores";
import { logTileChangeEvent } from "../../../../models/tiles/log/log-tile-change-event";
import { TileModel } from "../../../../models/tiles/tile-model";
import { IConnectFailure, kHelpSuccessLine } from "../../model/connect-failures";
import { DataflowContentModel } from "../../model/dataflow-content";
import { getDeviceConnection } from "../../model/device-connection";
import "../../dataflow-toolbar-registration";
import "../../dataflow-registration";

jest.mock("../../../../models/tiles/log/log-tile-change-event", () => ({ logTileChangeEvent: jest.fn() }));

const openFailed: IConnectFailure = {
  attemptId: "attempt-1", kind: "openFailed", choice: "arduino", step: "open", elapsedMs: 1200
};

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
});
