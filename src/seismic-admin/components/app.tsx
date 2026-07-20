import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { SeismicAdminStoreContext } from "../hooks/use-seismic-admin-stores";
import { initAdminFirebase } from "../utils/admin-firebase";
import { loadCatalog } from "../utils/load-catalog";
import { SeismicAdminStore } from "../seismic-admin-store";
import { AdminBody } from "./admin-body";
import { AdminHeader } from "./admin-header";
import "./app.scss";

export const App = observer(function App() {
  const [store, setStore] = useState<SeismicAdminStore | null>(null);

  // Load the optional ?unit= catalog before constructing the store so its stations
  // (with location + label) merge with whatever is already in OPFS.
  useEffect(() => {
    let cancelled = false;
    // Convert auth failure at the source so an unmount before the catalog resolves
    // never leaves an unhandled rejection. Resolves to null on success, else the reason.
    const authPromise = initAdminFirebase().then(
      () => null,
      err => {
        console.warn("Seismic admin Firebase sign-in failed:", err);
        return `${err?.message ?? err}`;
      });
    void loadCatalog().then(catalog => {
      if (cancelled) return;
      const created = new SeismicAdminStore({ catalog });
      setStore(created);
      void created.refresh();
      void authPromise.then(failure => {
        if (cancelled) return;
        if (failure === null) {
          created.setAuthReady();
        } else {
          created.setFeedback(`Event database unavailable (sign-in failed: ${failure}).`);
        }
      });
    });
    return () => { cancelled = true; };
  }, []);

  if (!store) return <div className="seismic-admin loading">Loading…</div>;

  return (
    <SeismicAdminStoreContext.Provider value={store}>
      <div className="seismic-admin">
        <AdminHeader />
        <AdminBody />
      </div>
    </SeismicAdminStoreContext.Provider>
  );
});
