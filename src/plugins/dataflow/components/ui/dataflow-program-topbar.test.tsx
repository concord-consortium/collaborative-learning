import React from "react";
import { act, render, screen } from "@testing-library/react";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";

import { specStores } from "../../../../models/stores/spec-stores";
import { specAppConfig } from "../../../../models/stores/spec-app-config";
import { ReadOnlyContext } from "../../../../components/document/read-only-context";
import { DataflowContentModel } from "../../model/dataflow-content";
import { ProgramDataRates } from "../../model/utilities/node";
import { getDeviceConnection } from "../../model/device-connection";
import { DataflowProgramTopbar } from "./dataflow-program-topbar";

import "../../dataflow-registration";

function renderTopbar(readOnly: boolean, tools?: string[]) {
  const stores = specStores(
    tools ? { appConfig: specAppConfig({ config: { settings: { dataflow: { tools } } } }) } : undefined
  );
  const tileContent = DataflowContentModel.create();
  const result = render(
    <ModalProvider>
      <Provider stores={stores}>
        <ReadOnlyContext.Provider value={readOnly}>
          <DataflowProgramTopbar
            programDataRates={ProgramDataRates}
            dataRate={ProgramDataRates[0].val}
            onRateSelectClick={jest.fn()}
            onConnectDevice={jest.fn()}
            onReconnectDevice={jest.fn()}
            onDisconnectDevice={jest.fn()}
            connection={getDeviceConnection(stores.serialDevice)}
            showRateUI={false}
            lastIntervalDuration={0}
            serialDevice={stores.serialDevice}
            tileContent={tileContent}
          />
        </ReadOnlyContext.Provider>
      </Provider>
    </ModalProvider>
  );
  return { ...result, tileContent };
}

// The failure this pins is silent: a control that stops reading the context stays live in a
// read-only document and looks entirely normal.
describe("DataflowProgramTopbar read-only state", () => {
  it("disables its controls when the document is read-only", () => {
    renderTopbar(true);
    expect(screen.getByTestId("rate-select")).toBeDisabled();
    expect(screen.getByTitle("Connect a device")).toBeDisabled();
  });

  it("leaves its controls enabled when the document is editable", () => {
    renderTopbar(false);
    expect(screen.getByTestId("rate-select")).toBeEnabled();
    expect(screen.getByTitle("Connect a device")).toBeEnabled();
  });
});

describe("DataflowProgramTopbar connect button", () => {
  it("is hidden when the tile toolbar has the connect button", () => {
    renderTopbar(false, ["pan", "|", "connect", "reset"]);
    expect(screen.queryByTitle("Connect a device")).toBeNull();
  });

  it("stays when the unit's tools list leaves out connect", () => {
    renderTopbar(false, ["pan"]);
    expect(screen.getByTitle("Connect a device")).toBeInTheDocument();
  });
});

describe("DataflowProgramTopbar while recording", () => {
  it("disables the rate selector and shows the elapsed time", () => {
    const { tileContent } = renderTopbar(false);
    expect(screen.getByTestId("rate-select")).toBeEnabled();
    expect(screen.queryByTestId("recording-elapsed")).toBeNull();

    act(() => { tileContent.startRecording(jest.fn()); });

    expect(screen.getByTestId("rate-select")).toBeDisabled();
    expect(screen.getByTestId("recording-elapsed")).toBeInTheDocument();
  });

  // The denominator is how long this program could still record; it shrinks as blocks are added.
  it("shows the elapsed time over the recordable window", () => {
    const { tileContent } = renderTopbar(false);
    act(() => { tileContent.startRecording(jest.fn()); });

    expect(screen.getByTestId("recording-elapsed").textContent)
      .toMatch(/^\d{2}:\d{2}\/\d{2,}:\d{2}$/);
  });
});
