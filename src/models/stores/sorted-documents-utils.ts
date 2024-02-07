import DataCardsTileIDIcon from "../../assets/icons/sort-by-tools/data-cards-tile-id.svg";
import DiagramTileIDIcon from "../../assets/icons/sort-by-tools/diagram-tile-id.svg";
import ExpressionTileIDIcon from "../../assets/icons/sort-by-tools/expression-tile-id.svg";
import GraphTileIDIcon from "../../assets/icons/sort-by-tools/graph-tile-id.svg";
import ImageTileIDIcon from "../../assets/icons/sort-by-tools/image-tile-id.svg";
import NumberlineTileIDIcon from "../../assets/icons/sort-by-tools/number-line-tile-id.svg";
import ProgramTileIDIcon from "../../assets/icons/sort-by-tools/program-tile-id.svg";
import ShapesGraphTileIDIcon from "../../assets/icons/sort-by-tools/shapes-graph-tile-id.svg";
// import SimulatorTileIDIcon from "../../assets/icons/sort-by-tools/simulator-tile-id.svg";
import SketchTileIDIcon from "../../assets/icons/sort-by-tools/sketch-tile-id.svg";
import SparrowTileIDIcon from "../../assets/icons/sort-by-tools/sparrow-id.svg";
import TableTileIDIcon from "../../assets/icons/sort-by-tools/table-tile-id.svg";
import TextTileIDIcon from "../../assets/icons/sort-by-tools/text-tile-id.svg";


export const sectionLabelFormatter = {
  DataCard: "Data Cards", //Old tile name has been revised
  Dataflow: "Program",
  Numberline: "Number Line",
  Geometry: "Shapes Graph",
  Drawing: "Sketch",
};


//TODO: Need to test SimulatorTile and DiagramTile but cant because they are not enabled on example-config-subtabs

//✔️ Data Cards (no label change)
//✔️Diagram (no label change; new icon -- we wanted to differentiate it from the Program icon)
//✔️Expression (no label change; minor icon update if this is easy to update)
//✔️Graph (formerly known as "XY Plot")
//✔️Image (no label change)
//✔️ Number Line (currently known as "Numberline" -- should be 2 words; minor icon update if this is easy to update)
//✔️ Program (currently known as "Dataflow")
//TODO: Simulator tile (currently known as "EMG Simulator"; new icon) - not found in example-config-subtabs
//✔️ Shapes Graph (currently known as "Shapes" or "Graph" in different projects; new icon) -- maybe we want to just use "Shapes"?
//✔️ Sketch (formerly known as "Drawing")
//✔️ Sparrow (no label change)
//✔️Table (no label change)
//✔️ Text (no label change)


export const sectionIconFormatter = {
  DataCard: DataCardsTileIDIcon,
  Diagram: DiagramTileIDIcon,
  Expression: ExpressionTileIDIcon,
  Graph: GraphTileIDIcon,
  Image: ImageTileIDIcon,
  Numberline: NumberlineTileIDIcon,
  Dataflow: ProgramTileIDIcon, //TODO: how do we want to stay consistent with this naming convention?
  Geometry: ShapesGraphTileIDIcon,
  Drawing: SketchTileIDIcon,
  Sparrow: SparrowTileIDIcon,
  Table: TableTileIDIcon,
  Text: TextTileIDIcon
};
