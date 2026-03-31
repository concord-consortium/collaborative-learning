import { useContext } from "react";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { isWaveRunnerContentModel, WaveRunnerContentModelType } from "../models/wave-runner-content";

/**
 * Returns the typed WaveRunnerContentModel from TileModelContext.
 * Throws if used outside a TileModelContext provider or if the content
 * is not a WaveRunnerContentModel.
 */
export function useWaveRunnerContent(): WaveRunnerContentModelType {
  const model = useContext(TileModelContext);
  const content = model?.content;
  if (!isWaveRunnerContentModel(content)) {
    throw new Error("useWaveRunnerContent must be used inside a Wave Runner tile");
  }
  return content;
}
