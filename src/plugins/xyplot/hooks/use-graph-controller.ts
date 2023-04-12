import {useEffect} from "react";
import { useDataSet } from "../../../hooks/use-data-set";
import {GraphController} from "../models/graph-controller";
import {IGraphModel} from "../models/graph-model";

export interface IUseGraphControllerProps {
  graphController: GraphController,
  graphModel?: IGraphModel,
}

export const useGraphController = ({graphController, graphModel}: IUseGraphControllerProps) => {
  const { data: dataset } = useDataSet(graphModel?.data);

  useEffect(() => {
    graphModel && graphController.setProperties({graphModel, dataset});
  }, [graphController, graphModel, dataset]);
};
