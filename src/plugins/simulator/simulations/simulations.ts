import { kBrainwavesKey } from "../../../../shared/simulations/brainwaves-gripper/brainwaves-gripper";
import { kPotentiometerServoKey } from "../../../../shared/simulations/potentiometer-servo/potentiometer-servo";
import { kTerrariumKey } from "../../../../shared/simulations/terrarium/terrarium";
import { brainwavesGripperSimulation } from "./brainwaves-gripper/brainwaves-gripper";
import { terrariumSimulation } from "./terrarium/terrarium";
import { ISimulation } from "./simulation-types";
import { potentiometerAndServoSimulation } from "./potentiometer-servo/potentiometer-servo";

// The simulation to use when none is specified.
export const defaultSimulationKey = kBrainwavesKey;

export const simulations: Record<string, ISimulation> = {
  [kBrainwavesKey]: brainwavesGripperSimulation,
  [kTerrariumKey]: terrariumSimulation,
  [kPotentiometerServoKey]: potentiometerAndServoSimulation
};
