import { brainwavesGripperSimulation, kBrainwavesKey } from "./brainwaves-gripper";
import { ISimulation } from "./simulation-types";

export const simulations: Record<string, ISimulation> = {
  [kBrainwavesKey]: brainwavesGripperSimulation
};
