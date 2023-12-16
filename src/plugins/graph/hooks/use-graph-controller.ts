import {useEffect} from "react";
import {GraphController} from "../models/graph-controller";
import {IGraphModel} from "../models/graph-model";

export interface IUseGraphControllerProps {
  graphController: GraphController,
  graphModel?: IGraphModel,
}

export const useGraphController = ({graphController, graphModel}: IUseGraphControllerProps) => {
  useEffect(() => {
    graphModel && graphController.setProperties({graphModel});
  }, [graphController, graphModel]);
};
