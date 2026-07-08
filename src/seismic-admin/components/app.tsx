import { observer } from "mobx-react";
import React, { useEffect, useMemo } from "react";
import { SeismicAdminStore } from "../seismic-admin-store";

// Shell for the seismic admin page. The header and station sections are added in later tasks.
export const App = observer(function App() {
  const store = useMemo(() => new SeismicAdminStore(), []);
  useEffect(() => { void store.refresh(); }, [store]);

  return (
    <div className="seismic-admin">
      <h1>Seismic Admin</h1>
      <p>{store.stations.size} station(s) in the local cache</p>
    </div>
  );
});
