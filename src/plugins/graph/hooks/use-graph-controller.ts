import {useEffect} from "react";
import {IDataSet} from "../../../models/data/data-set";
import {IDotsRef} from "../graph-types";
import {GraphController} from "../models/graph-controller";
import {IGraphModel} from "../models/graph-model";

export interface IUseGraphControllerProps {
  data?: IDataSet,
  graphController: GraphController,
  graphModel?: IGraphModel,
  dotsRef: IDotsRef
}

export const useGraphController = ({data, graphController, graphModel, dotsRef}: IUseGraphControllerProps) => {
  useEffect(() => {
    graphModel && graphController.setProperties({data, graphModel, dotsRef});
  }, [data, graphController, graphModel, dotsRef]);
};
