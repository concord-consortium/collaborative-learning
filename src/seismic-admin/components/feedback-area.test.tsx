import React from "react";
import { render, screen } from "@testing-library/react";
import { FeedbackArea } from "./feedback-area";
import { SeismicAdminStore } from "../seismic-admin-store";
import { SeismicAdminStoreContext } from "../hooks/use-seismic-admin-stores";

function renderFeedback(store: SeismicAdminStore) {
  return render(
    <SeismicAdminStoreContext.Provider value={store}>
      <FeedbackArea />
    </SeismicAdminStoreContext.Provider>
  );
}

describe("FeedbackArea", () => {
  beforeEach(() => window.localStorage.clear());

  it("renders the store's feedback message", () => {
    const store = new SeismicAdminStore({ cache: {} as any });
    store.setFeedback("Downloading day 3 of 31 for Rabbit Creek, AK");
    renderFeedback(store);

    expect(screen.getByRole("status")).toHaveTextContent("Downloading day 3 of 31 for Rabbit Creek, AK");
  });

  it("renders nothing when the store is idle", () => {
    const store = new SeismicAdminStore({ cache: {} as any });
    renderFeedback(store);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
