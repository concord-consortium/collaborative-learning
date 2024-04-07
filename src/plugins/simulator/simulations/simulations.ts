import { brainwavesGripperSimulation, kBrainwavesKey } from "./brainwaves-gripper/brainwaves-gripper";
import { kTerrariumKey, terrariumSimulation } from "./terrarium/terrarium";
import { ISimulation } from "./simulation-types";
import { kPotentiometerServoKey, potentiometerAndServoSimulation } from "./potentiometer-servo/potentiometer-servo";

// The simulation to use when none is specified.
export const defaultSimulationKey = kBrainwavesKey;

export const simulations: Record<string, ISimulation> = {
  [kBrainwavesKey]: brainwavesGripperSimulation,
  [kTerrariumKey]: terrariumSimulation,
  [kPotentiometerServoKey]: potentiometerAndServoSimulation
};
