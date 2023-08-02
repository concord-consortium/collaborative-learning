import React from "react";
import classNames from "classnames";
import PlacePointButton from "./assets/numberline-toolbar-point-icon.svg";


interface ISetPlacePoint {
  onClick: () => void;
}

export const SetPlacePoint = ({ onClick }: ISetPlacePoint) => (
  <PlacePointButton
  />
);
