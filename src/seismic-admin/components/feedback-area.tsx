import { observer } from "mobx-react-lite";
import React from "react";
import { useSeismicAdminStore } from "../hooks/use-seismic-admin-stores";
import "./feedback-area.scss";

export const FeedbackArea = observer(function FeedbackArea() {
  const store = useSeismicAdminStore();

  return <div className="feedback-area" role="status">{store.feedback}</div>;
});
