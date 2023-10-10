import { brainwavesGripperSimulation, kBrainwavesKey } from "./brainwaves-gripper/brainwaves-gripper";
import { kTerrariumKey, terrariumSimulation } from "./terrarium/terrarium";
import { ISimulation } from "./simulation-types";

// The simulation to use when none is specified.
export const defaultSimulationKey = kBrainwavesKey;

export const simulations: Record<string, ISimulation> = {
  [kBrainwavesKey]: brainwavesGripperSimulation,
  [kTerrariumKey]: terrariumSimulation
};
