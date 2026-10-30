import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { runInAction } from "mobx";
import { destroy } from "mobx-state-tree";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";
import { RightDrawer } from "../../../../components/right-drawer/right-drawer";
import { TileModelContext } from "../../../../components/tiles/tile-api";
import { getToolbarButtonInfo } from "../../../../components/toolbar/toolbar-button-manager";
import { LogEventName } from "../../../../lib/logger-types";
import { SerialDevice } from "../../../../models/stores/serial";
import { specStores } from "../../../../models/stores/spec-stores";
import { logTileChangeEvent } from "../../../../models/tiles/log/log-tile-change-event";
import { TileModel } from "../../../../models/tiles/tile-model";
import { IConnectFailure } from "../../model/connect-failures";
import { DataflowContentModel } from "../../model/dataflow-content";
import { getDeviceConnection } from "../../model/device-connection";
import { openConnectionHelp } from "./connection-help-panel";
import "../../dataflow-toolbar-registration";
import "../../dataflow-registration";

jest.mock("../../../../models/tiles/log/log-tile-change-event", () => ({ logTileChangeEvent: jest.fn() }));

const openFailed: IConnectFailure = { kind: "openFailed", choice: "arduino", step: "open", elapsedMs: 1200 };
const noData: IConnectFailure = { kind: "noData", choice: "arduino", step: "waitForData", elapsedMs: 5000 };

const fakeTransport = () => ({
  close: jest.fn(), write: jest.fn(), onData: undefined, onDisconnect: undefined
}) as unknown as Parameters<SerialDevice["setActiveDevice"]>[1];

function helpEvents(operation: string) {
  return jest.mocked(logTileChangeEvent).mock.calls
    .filter(([, params]) => params.operation === operation)
    .map(([event, params]) => ({ event, tileId: params.tileId, change: params.change }));
}

// The drawer, and with `withTile` a Dataflow tile's connect button, sharing one connection. The
// button is rendered on its own, so a test can unmount it as deleting the tile does.
function renderHelp({ withTile = false } = {}) {
  const stores = specStores();
  const connection = getDeviceConnection(stores.serialDevice);
  const content = DataflowContentModel.create();
  const model = TileModel.create({ content });
  const ConnectButton = getToolbarButtonInfo("dataflow", "connect")!.component;
  render(<Provider stores={stores}><RightDrawer chatTutorAvailable={false} /></Provider>);
  const tile = withTile
    ? render(
        <ModalProvider>
          <Provider stores={stores}>
            <TileModelContext.Provider value={model}>
              <ConnectButton name="connect" />
            </TileModelContext.Provider>
          </Provider>
        </ModalProvider>
      )
    : undefined;
  const trigger = () => document.querySelector<HTMLButtonElement>("button.toolbar-button.connect")!;
  return { tile, trigger, stores, connection, content, model };
}

type Rendered = ReturnType<typeof renderHelp>;

function fail(r: Rendered, failure: IConnectFailure) {
  act(() => runInAction(() => {
    r.connection.lastChoice = failure.choice;
    r.connection.lastFailure = failure;
  }));
}

function showHelpFor(r: Rendered, failure: IConnectFailure) {
  fail(r, failure);
  act(() => openConnectionHelp({
    connection: r.connection, ui: r.stores.ui, topic: r.connection.helpTopic(failure.kind, "tile-1")!
  }));
}

const drawer = () => screen.getByRole("complementary", { name: "Arduino connection" });

describe("ConnectionHelpPanel", () => {
  beforeEach(() => jest.mocked(logTileChangeEvent).mockClear());

  it("shows the live status, headline, success line, tries and collapsed Details", () => {
    const r = renderHelp();
    showHelpFor(r, openFailed);
    expect(within(drawer()).getByRole("heading", { name: "Arduino connection" })).toBeInTheDocument();
    expect(within(drawer()).getByText("Not connected")).toBeInTheDocument();
    expect(within(drawer()).getByText("Couldn't open it.")).toBeInTheDocument();
    expect(within(drawer()).queryByText("More…")).toBeNull();
    expect(within(drawer()).getByText("The browser couldn't open the Arduino.")).toBeInTheDocument();
    expect(within(drawer()).getByText(
      "Try these in order. When it works, the connect button turns green.")).toBeInTheDocument();
    const tries = within(drawer()).getAllByRole("listitem");
    expect(tries.map(t => t.textContent)).toEqual([
      "Unplug the Arduino, plug it back in, and click Connect.",
      "Still not working? Reload this page, then click Connect."
    ]);
    expect(within(tries[1]).getByText("Still not working?").tagName).toBe("EM");
    expect(within(drawer()).getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "false");
    expect(within(drawer()).queryByText("Step: open.")).toBeNull();
    expect(helpEvents("showConnectHelp")).toEqual([{
      event: LogEventName.DATAFLOW_TOOL_CHANGE, tileId: "tile-1",
      change: { targetType: "connectHelp", kind: "openFailed" }
    }]);

    // The status lines follow the connection; the steps stay.
    act(() => runInAction(() => {
      r.connection.lastFailure = undefined;
      r.stores.serialDevice.setActiveDevice("arduino", fakeTransport());
    }));
    expect(within(drawer()).getByText("Connected: Arduino")).toBeInTheDocument();
    expect(within(drawer()).getByText("Waiting for data…")).toBeInTheDocument();
    expect(within(drawer()).getByText("The browser couldn't open the Arduino.")).toBeInTheDocument();
  });

  it("Details expands and collapses with aria-expanded", () => {
    const r = renderHelp();
    showHelpFor(r, openFailed);
    const details = within(drawer()).getByRole("button", { name: "Details" });
    fireEvent.click(details);
    expect(details).toHaveAttribute("aria-expanded", "true");
    expect(within(drawer()).getByText("Step: open.")).toBeInTheDocument();
    fireEvent.click(details);
    expect(details).toHaveAttribute("aria-expanded", "false");
    expect(within(drawer()).queryByText("Step: open.")).toBeNull();
  });

  it("Close help closes the drawer and logs hideConnectHelp with trigger closeHelp", () => {
    const r = renderHelp();
    act(() => r.stores.serialDevice.setActiveDevice("arduino", fakeTransport()));
    showHelpFor(r, noData);
    act(() => runInAction(() => {
      r.connection.lastFailure = undefined;
      r.stores.serialDevice.markDataReceived();
    }));
    const notice = within(drawer()).getByRole("status");
    expect(notice).toHaveTextContent("It's working now. The Arduino is sending data.");
    expect(within(notice).getByText("It's working now.").tagName).toBe("STRONG");
    expect(within(drawer()).getByText("The Arduino isn't sending anything.").closest(".connection-help-steps"))
      .toHaveClass("faded");
    expect(helpEvents("connectHelpNotice")).toEqual([expect.objectContaining({
      tileId: "tile-1", change: { targetType: "connectHelp", notice: "working", action: "shown" }
    })]);

    fireEvent.click(within(notice).getByRole("button", { name: "Close help" }));
    expect(screen.queryByTestId("right-drawer")).toBeNull();
    expect(r.connection.help).toBeUndefined();
    expect(helpEvents("connectHelpNotice")[1]).toEqual(expect.objectContaining({
      change: { targetType: "connectHelp", notice: "working", action: "clicked" }
    }));
    expect(helpEvents("hideConnectHelp")).toEqual([expect.objectContaining({
      tileId: "tile-1", change: { targetType: "connectHelp", kind: "noData", trigger: "closeHelp" }
    })]);
    act(() => r.stores.serialDevice.clearActiveDevice());
  });

  it("Show steps for this replaces the steps and logs connectHelpNotice clicked", () => {
    const r = renderHelp();
    showHelpFor(r, openFailed);
    fail(r, noData);
    const notice = within(drawer()).getByRole("status");
    expect(notice).toHaveTextContent("Something else went wrong: the Arduino isn't sending anything.");
    expect(within(drawer()).getByText("The browser couldn't open the Arduino.")).toBeInTheDocument();
    expect(within(drawer()).getByText("The browser couldn't open the Arduino.").closest(".connection-help-steps"))
      .not.toHaveClass("faded");

    fireEvent.click(within(notice).getByRole("button", { name: "Show steps for this" }));
    expect(within(drawer()).getByRole("status")).toBeEmptyDOMElement();
    expect(within(drawer()).queryByText("The browser couldn't open the Arduino.")).toBeNull();
    expect(within(drawer()).getByText("The Arduino isn't sending anything.")).toBeInTheDocument();
    expect(within(drawer()).getAllByRole("listitem")[0]).toHaveTextContent("Click Reconnect.");
    expect(helpEvents("connectHelpNotice")).toEqual([
      expect.objectContaining({
        change: { targetType: "connectHelp", notice: "differentProblem", kind: "noData", action: "shown" }
      }),
      expect.objectContaining({
        tileId: "tile-1",
        change: { targetType: "connectHelp", notice: "differentProblem", kind: "noData", action: "clicked" }
      })
    ]);
  });

  it("an unplug or a disconnect shows what to do next, and leaves the steps as they were", () => {
    const r = renderHelp();
    act(() => r.stores.serialDevice.setActiveDevice("arduino", fakeTransport()));
    showHelpFor(r, noData);
    act(() => runInAction(() => {
      r.connection.lastFailure = undefined;
      r.stores.serialDevice.clearActiveDevice("unplugged");
    }));
    const notice = within(drawer()).getByRole("status");
    expect(notice).toHaveTextContent("The Arduino was unplugged. Plug it back in and click Connect.");
    expect(within(notice).getByText("The Arduino was unplugged.").tagName).toBe("STRONG");
    expect(within(notice).queryByRole("button")).toBeNull();
    expect(within(drawer()).getByText("It was unplugged.")).toBeInTheDocument();
    expect(within(drawer()).getByText("The Arduino isn't sending anything.").closest(".connection-help-steps"))
      .not.toHaveClass("faded");

    act(() => r.stores.serialDevice.clearLastLoss());
    expect(notice).toHaveTextContent("The Arduino isn't connected. Click Connect to try again.");
    expect(helpEvents("connectHelpNotice")).toEqual([
      expect.objectContaining({
        tileId: "tile-1", change: { targetType: "connectHelp", notice: "unplugged", action: "shown" }
      }),
      expect.objectContaining({
        tileId: "tile-1", change: { targetType: "connectHelp", notice: "notConnected", action: "shown" }
      })
    ]);
  });

  it("keeps working when the tile that opened it is deleted", () => {
    const r = renderHelp({ withTile: true });
    act(() => r.stores.serialDevice.setActiveDevice("arduino", fakeTransport()));
    act(() => r.content.setConnectFailure(noData));
    fail(r, noData);
    fireEvent.click(r.trigger());
    fireEvent.click(screen.getByRole("button", { name: "More…" }));
    const tileId = r.model.id;
    destroy(r.model);
    r.tile!.unmount();

    act(() => runInAction(() => {
      r.connection.lastFailure = undefined;
      r.stores.serialDevice.markDataReceived();
    }));
    expect(within(drawer()).getByRole("status")).toHaveTextContent("It's working now.");
    expect(within(drawer()).getByText("Receiving data.")).toBeInTheDocument();
    fireEvent.click(within(drawer()).getByRole("button", { name: "Close help" }));
    expect(screen.queryByTestId("right-drawer")).toBeNull();
    expect(helpEvents("hideConnectHelp")).toEqual([expect.objectContaining({ tileId })]);
    act(() => r.stores.serialDevice.clearActiveDevice());
  });

  it("More… opens the drawer and moves focus to its heading", () => {
    const r = renderHelp({ withTile: true });
    act(() => r.content.setConnectFailure(openFailed));
    fail(r, openFailed);
    fireEvent.click(r.trigger());
    fireEvent.click(screen.getByRole("button", { name: "More…" }));
    expect(document.activeElement).toBe(within(drawer()).getByRole("heading", { name: "Arduino connection" }));
    expect(r.stores.ui.drawerPanel?.tabLabel).toBe("Connection help");
    expect(helpEvents("showConnectHelp")).toEqual([expect.objectContaining({
      tileId: r.model.id, change: { targetType: "connectHelp", kind: "openFailed" }
    })]);
  });

  it("Escape in the drawer closes it and returns focus to More…", () => {
    const r = renderHelp({ withTile: true });
    act(() => r.content.setConnectFailure(openFailed));
    fail(r, openFailed);
    fireEvent.click(r.trigger());
    fireEvent.click(screen.getByRole("button", { name: "More…" }));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByTestId("right-drawer")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "More…" }));
    expect(helpEvents("hideConnectHelp")).toEqual([expect.objectContaining({
      change: { targetType: "connectHelp", kind: "openFailed", trigger: "close" }
    })]);
  });

  it("✕ closes it and returns focus to the connect button when More… isn't showing", () => {
    const r = renderHelp({ withTile: true });
    showHelpFor(r, openFailed);
    fireEvent.click(within(drawer()).getByRole("button", { name: "Close connection help" }));
    expect(screen.queryByTestId("right-drawer")).toBeNull();
    expect(document.activeElement).toBe(r.trigger());
  });
});
