import React from "react";
import { ISimulation, ISimulationProps } from "../simulation-types";

export const kPotentiometerServoKey = "potentiometer_chip_servo";

function PotentiometerAndServoComponent({ frame, variables }: ISimulationProps) {

  return (
    <div className="potentiometer-servo-component">
      <div>pot</div>
      <div>board</div>
      <div>servo</div>
    </div>
  );
}

function step({ frame, variables }: ISimulationProps) {
  console.log("| find variables and set values");
}

export const potentiometerAndServoSimulation: ISimulation = {
  component: PotentiometerAndServoComponent,
  delay: 67,
  step,
  variables: [
    {
      displayName: "Potentiometer Position",
      labels: undefined,//["input", "sensor:temperature"],
      icon: undefined, // iconUrl(kPotentiometerAngleKey),
      name: "replaceMe",
      value: 180,
      unit: "°"
    }
  ],
  values: {}
};
