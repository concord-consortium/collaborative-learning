import { AttributeType } from "../../../../models/data/attribute";
import { IDataSet } from "../../../../models/data/data-set";
import { GraphPlace } from "../../imports/components/axis-graph-shared";
import { IGraphModel } from "../../models/graph-model";

export interface ILegendPartProps {
  onChangeAttribute?: (place: GraphPlace, dataSet: IDataSet, attrId: string, oldAttrId?: string) => void;
  onRemoveAttribute?: (place: GraphPlace, attrId: string) => void;
  onTreatAttributeAs?: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void;
}

export interface ILegendHeightFunctionProps {
  graphModel: IGraphModel;
}
export type LegendHeightFunction = (props: ILegendHeightFunctionProps) => number;
