import { observer } from "mobx-react-lite";
import React from "react";
import { useSeismicAdminStore } from "../hooks/use-seismic-admin-stores";
import "./feedback-area.scss";
import clsx from "clsx";

export const FeedbackArea = observer(function FeedbackArea() {
  const store = useSeismicAdminStore();

  return (
    <div className={clsx("feedback-area", { busy: store.isBusy })} role="status">
      {store.feedback}
    </div>
  );
});
