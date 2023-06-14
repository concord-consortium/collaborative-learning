import { brainwavesGrabberSimulation, kBrainwavesKey } from "./brainwaves-grabber";
import { ISimulation } from "./simulation-types";

export const simulations: Record<string, ISimulation> = {
  [kBrainwavesKey]: brainwavesGrabberSimulation
};
