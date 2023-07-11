import { brainwavesGripperSimulation, kBrainwavesKey } from "./brainwaves-gripper/brainwaves-gripper";
import { kTerrariumKey, terrariumSimulation } from "./terrarium/terrarium";
import { ISimulation } from "./simulation-types";

export const simulations: Record<string, ISimulation> = {
  [kBrainwavesKey]: brainwavesGripperSimulation,
  [kTerrariumKey]: terrariumSimulation
};
