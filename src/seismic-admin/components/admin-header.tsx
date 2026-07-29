import { observer } from "mobx-react";
import React from "react";
import CheckIcon from "../../assets/icons/check/check-selected.svg";
import { useSeismicAdminStore } from "../hooks/use-seismic-admin-stores";
import { buildAuthorizeUrl } from "../utils/portal-auth";
import { getStationLabel } from "../utils/seismic-admin-utils";
import "./admin-header.scss";
import { FeedbackArea } from "./feedback-area";

export const AdminHeader = observer(function AdminHeader() {
  const store = useSeismicAdminStore();

  // A cleared date input reports "", which isn't a usable range — ignore it.
  const setStart = (value: string) => { if (value) store.setRange(value, store.endDate); };
  const setEnd = (value: string) => { if (value) store.setRange(store.startDate, value); };

  return (
    <div className="admin-header">
      <div className="title-row">
        <h3>Seismic Admin</h3>
        {store.portalReady
          ? <div className="title-row">Portal: signed in <CheckIcon className="icon"/></div>
          : (
            <button onClick={() => { window.location.href = buildAuthorizeUrl(); }}>
              Log in with Portal
            </button>
          )
        }
      </div>
      <div className="options">
        <div className="option-area">
          <div className="option-header">Date Range</div>
          <div className="dates">
            <label>
              Start&nbsp;
              <input
                disabled={store.isBusy}
                type="date"
                value={store.startDate}
                onChange={e => setStart(e.target.value)}
              />
            </label>
            <label>
              End&nbsp;
              <input
                disabled={store.isBusy}
                type="date"
                value={store.endDate}
                onChange={e => setEnd(e.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="option-area">
          <div className="option-header">Stations</div>
          <div className="checkbox-list">
            {[...store.stations].map(([key, station]) => {
              const checked = store.selectedStations.has(key);
              return (
                <label className="checkbox" key={key}>
                  <input
                    type="checkbox"
                    disabled={store.isBusy || (checked && store.selectedStations.size === 1)}
                    checked={checked}
                    onChange={() => store.toggleStation(key)}
                  />
                  {getStationLabel(station)}
                </label>
              );
            })}
          </div>
        </div>
        <div className="option-area">
          <div className="option-header">Models</div>
          <div className="checkbox-list">
            {[...store.models].map(([url, model]) => (
              <label className="checkbox" key={url}>
                <input
                  disabled={store.isBusy}
                  type="checkbox"
                  checked={store.selectedModels.has(url)}
                  onChange={() => store.toggleModel(url)}
                />
                {model.label}
              </label>
            ))}
          </div>
        </div>
      </div>
      <FeedbackArea />
    </div>
  );
});
