import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { SeismicAdminStoreContext } from "../hooks/use-seismic-admin-stores";
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
    void loadCatalog().then(catalog => {
      if (cancelled) return;
      const created = new SeismicAdminStore({ catalog });
      setStore(created);
      void created.refresh();
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
