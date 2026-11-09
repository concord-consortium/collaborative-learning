import { useContext } from "react";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { DataflowContentModelType, isDataflowContentModel } from "../model/dataflow-content";

/**
 * Returns the typed DataflowContentModel from TileModelContext.
 * Throws if used outside a TileModelContext provider or if the content
 * is not a DataflowContentModel.
 */
export function useDataflowContent(): DataflowContentModelType {
  const model = useContext(TileModelContext);
  const content = model?.content;
  if (!isDataflowContentModel(content)) {
    throw new Error("useDataflowContent must be used inside a Dataflow tile");
  }
  return content;
}
