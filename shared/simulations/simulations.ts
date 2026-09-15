import { brainwavesGripperData, kBrainwavesKey } from "./brainwaves-gripper/brainwaves-gripper";
import {
  kPotentiometerServoKey, potentiometerAndServoData
} from "./potentiometer-servo/potentiometer-servo";
import { ISimulationData } from "./simulation-types";
import { kTerrariumKey, terrariumData } from "./terrarium/terrarium";

// A Simulator tile stores only its simulation key; everything describing the simulation is
// authored here. Any consumer that has to turn that key into a description needs this map, so it
// lives beside the simulations rather than inside whichever consumer needed it first.
const kSimulations: Record<string, ISimulationData> = {
  [kBrainwavesKey]: brainwavesGripperData,
  [kPotentiometerServoKey]: potentiometerAndServoData,
  [kTerrariumKey]: terrariumData,
};

/** The authored data for a simulation key, or undefined for a key we do not know. */
export function getSimulationData(simulation: string | undefined): ISimulationData | undefined {
  return simulation ? kSimulations[simulation] : undefined;
}
