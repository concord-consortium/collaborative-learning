import { useContext } from "react";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { isSimulatorModel, SimulatorContentModelType } from "../model/simulator-content";

/**
 * Returns the typed SimulatorContentModel from TileModelContext.
 * Throws if used outside a TileModelContext provider or if the content
 * is not a SimulatorContentModel.
 */
export function useSimulatorContent(): SimulatorContentModelType {
  const model = useContext(TileModelContext);
  const content = model?.content;
  if (!isSimulatorModel(content)) {
    throw new Error("useSimulatorContent must be used inside a Simulator tile");
  }
  return content;
}
