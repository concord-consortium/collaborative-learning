import {useEffect} from "react";
import { useDataSet } from "./use-data-set";
import {IDotsRef} from "../graph-types";
import {GraphController} from "../models/graph-controller";
import {IGraphModel} from "../models/graph-model";

export interface IUseGraphControllerProps {
  graphController: GraphController,
  graphModel?: IGraphModel,
  dotsRef: IDotsRef
}

export const useGraphController = ({graphController, graphModel, dotsRef}: IUseGraphControllerProps) => {
  const { data: dataset } = useDataSet(graphModel?.data);

  useEffect(() => {
    graphModel && graphController.setProperties({graphModel, dataset, dotsRef});
  }, [graphController, graphModel, dataset, dotsRef]);
};
