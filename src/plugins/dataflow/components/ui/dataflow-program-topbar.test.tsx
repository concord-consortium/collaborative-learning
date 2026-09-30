import React from "react";
import { render, screen } from "@testing-library/react";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";

import { specStores } from "../../../../models/stores/spec-stores";
import { ReadOnlyContext } from "../../../../components/document/read-only-context";
import { DataflowContentModel } from "../../model/dataflow-content";
import { ProgramDataRates } from "../../model/utilities/node";
import { ProgramMode } from "../types/dataflow-tile-types";
import { DataflowProgramTopbar } from "./dataflow-program-topbar";

import "../../dataflow-registration";

function renderTopbar(readOnly: boolean) {
  const stores = specStores();
  return render(
    <ModalProvider>
      <Provider stores={stores}>
        <ReadOnlyContext.Provider value={readOnly}>
          <DataflowProgramTopbar
            programDataRates={ProgramDataRates}
            dataRate={ProgramDataRates[0].val}
            onRateSelectClick={jest.fn()}
            onConnectDevice={jest.fn()}
            showRateUI={false}
            lastIntervalDuration={0}
            serialDevice={stores.serialDevice}
            handleChangeOfProgramMode={jest.fn()}
            programMode={ProgramMode.Ready}
            playBackIndex={0}
            isPlaying={false}
            handleChangeIsPlaying={jest.fn()}
            tileContent={DataflowContentModel.create()}
          />
        </ReadOnlyContext.Provider>
      </Provider>
    </ModalProvider>
  );
}

// The failure this pins is silent: a control that stops reading the context stays live in a
// read-only document and looks entirely normal.
describe("DataflowProgramTopbar read-only state", () => {
  it("disables its controls when the document is read-only", () => {
    renderTopbar(true);
    expect(screen.getByTestId("record-data-button")).toBeDisabled();
    expect(screen.getByTestId("rate-select")).toBeDisabled();
    expect(screen.getByTitle("Connect a device")).toBeDisabled();
  });

  it("leaves its controls enabled when the document is editable", () => {
    renderTopbar(false);
    expect(screen.getByTestId("record-data-button")).toBeEnabled();
    expect(screen.getByTestId("rate-select")).toBeEnabled();
    expect(screen.getByTitle("Connect a device")).toBeEnabled();
  });
});
