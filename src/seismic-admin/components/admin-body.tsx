import { observer } from "mobx-react-lite";
import React from "react";
import { getStationChannelPrefix } from "../../../shared/seismic/tile-addressing";
import { useSeismicAdminStore } from "../hooks/use-seismic-admin-stores";
import { StationSection } from "./station-section";

export const AdminBody = observer(function AdminBody() {
  const store = useSeismicAdminStore();

  return (
    <div className="admin-body">
      {store.selected.size > 1 && <StationSection />}
      {store.selectedStations.map(station => {
        const key = getStationChannelPrefix(station);
        return <StationSection key={key} stationKey={key} />;
      })}
    </div>
  );
});
