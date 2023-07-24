import classNames from "classnames";
import { observer } from "mobx-react";
import React from "react";

import { useUIStore } from "../../hooks/use-stores";

import "./adornmentLayer.scss";

export const AdornmentLayer = observer(function AdornmentLayer() {
  const ui = useUIStore();

  const editting = ui.adornmentMode !== undefined;
  const hidden = !ui.showAdornments;
  const classes = classNames("adornment-layer", { editting, hidden });
  return (
    <div className={classes}>
      <h1>Adornment Layer!</h1>
    </div>
  );
});
