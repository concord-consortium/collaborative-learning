import DataCardsTileIDIcon from "../../assets/icons/sort-by-tools/data-cards-tile-id.svg";
import DiagramTileIDIcon from "../../assets/icons/sort-by-tools/diagram-tile-id.svg";
import ExpressionTileIDIcon from "../../assets/icons/sort-by-tools/expression-tile-id.svg";
import GraphTileIDIcon from "../../assets/icons/sort-by-tools/graph-tile-id.svg";
import ImageTileIDIcon from "../../assets/icons/sort-by-tools/image-tile-id.svg";
import NumberlineTileIDIcon from "../../assets/icons/sort-by-tools/number-line-tile-id.svg";
import ProgramTileIDIcon from "../../assets/icons/sort-by-tools/program-tile-id.svg";
import ShapesGraphTileIDIcon from "../../assets/icons/sort-by-tools/shapes-graph-tile-id.svg";
import SimulatorTileIDIcon from "../../assets/icons/sort-by-tools/simulator-tile-id.svg";
import SketchTileIDIcon from "../../assets/icons/sort-by-tools/sketch-tile-id.svg";
import SparrowTileIDIcon from "../../assets/icons/sort-by-tools/sparrow-id.svg";
import TableTileIDIcon from "../../assets/icons/sort-by-tools/table-tile-id.svg";
import TextTileIDIcon from "../../assets/icons/sort-by-tools/text-tile-id.svg";

//************************************** Sort by Tools ************************************************
//Used as a lookup table for the rendered tile name from old names to new name
export const sectionLabelFormatter = {
  DataCard: "Data Cards",
  Dataflow: "Program",
  Numberline: "Number Line",
  Geometry: "Shapes Graph",
  Drawing: "Sketch",
};

export const sectionIconFormatter = {
  DataCard: DataCardsTileIDIcon,
  Diagram: DiagramTileIDIcon,
  Expression: ExpressionTileIDIcon,
  Graph: GraphTileIDIcon,
  Image: ImageTileIDIcon,
  Numberline: NumberlineTileIDIcon,
  Dataflow: ProgramTileIDIcon,
  Geometry: ShapesGraphTileIDIcon,
  Drawing: SketchTileIDIcon,
  Sparrow: SparrowTileIDIcon,
  Table: TableTileIDIcon,
  Text: TextTileIDIcon,
  Simulator: SimulatorTileIDIcon
};
