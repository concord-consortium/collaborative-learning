import React from "react";
import ReactDOM from "react-dom";
import "regenerator-runtime/runtime";
import { inject, observer } from "mobx-react";
import { BaseComponent } from "../../../components/base";
import Rete, { NodeEditor, Engine, Node } from "rete";
import ConnectionPlugin from "rete-connection-plugin";
import ReactRenderPlugin from "rete-react-render-plugin";
import { autorun } from "mobx";
import { IDisposer, onSnapshot } from "mobx-state-tree";
import { SizeMeProps } from "react-sizeme";
import { forEach } from "lodash";
import { ProgramZoomType, DataflowContentModelType } from "../model/dataflow-content";
import { DataflowProgramModelType } from "../model/dataflow-program-model";
import { SensorSelectControl } from "../nodes/controls/sensor-select-control";
import { DataflowReteNodeFactory } from "../nodes/factories/dataflow-rete-node-factory";
import { NumberReteNodeFactory } from "../nodes/factories/number-rete-node-factory";
import { MathReteNodeFactory } from "../nodes/factories/math-rete-node-factory";
import { TransformReteNodeFactory } from "../nodes/factories/transform-rete-node-factory";
import { ControlReteNodeFactory } from "../nodes/factories/control-rete-node-factory";
import { LogicReteNodeFactory } from "../nodes/factories/logic-rete-node-factory";
import { SensorReteNodeFactory } from "../nodes/factories/sensor-rete-node-factory";
import { DemoOutputReteNodeFactory } from "../nodes/factories/demo-output-rete-node-factory";
import { LiveOutputReteNodeFactory } from "../nodes/factories/live-output-rete-node-factory";
import { GeneratorReteNodeFactory } from "../nodes/factories/generator-rete-node-factory";
import { TimerReteNodeFactory } from "../nodes/factories/timer-rete-node-factory";
import { NumControl } from "../nodes/controls/num-control";
import { ValueControl } from "../nodes/controls/value-control";
import { DataflowDropZone } from "./ui/dataflow-drop-zone";
import { DataflowProgramToolbar } from "./ui/dataflow-program-toolbar";
import { DataflowProgramTopbar } from "./ui/dataflow-program-topbar";
import { DataflowProgramCover } from "./ui/dataflow-program-cover";
import { DataflowProgramZoom } from "./ui/dataflow-program-zoom";
import { NodeChannelInfo, serialSensorChannels } from "../model/utilities/channel";
import { NodeGeneratorTypes, ProgramDataRates, NodeTimerInfo } from "../model/utilities/node";
import { virtualSensorChannels } from "../model/utilities/virtual-channel";
import { Rect, scaleRect, unionRect } from "../utilities/rect";
import { DocumentContextReact } from "../../../components/document/document-context";
import { SerialDevice } from "../../../models/stores/serial";
import { dataflowLogEvent } from "../dataflow-logger";
import { ICaseCreation, addCanonicalCasesToDataSet } from "../../../models/data/data-set";
import { SensorValueControl } from "../nodes/controls/sensor-value-control";
import { InputValueControl } from "../nodes/controls/input-value-control";
import { DemoOutputControl } from "../nodes/controls/demo-output-control";
import { DropdownListControl } from "../nodes/controls/dropdown-list-control";
import { ProgramMode, UpdateMode } from "./types/dataflow-tile-types";

import "./dataflow-program.sass";
interface NodeNameValuePair {
  name: string;
  val: number;
}
interface NodeValueMap {
  [key: string]: NodeNameValuePair;
}
type NodeValue = number | NodeValueMap;

export interface IStartProgramParams {
  runId: string;
  startTime: number;
  endTime: number;
  hasData: boolean;
  title: string;
}

interface IProps extends SizeMeProps {
  readOnly?: boolean;
  documentProperties?: { [key: string]: string };
  program?: DataflowProgramModelType;
  onProgramChange: (program: any) => void;
  programDataRate: number;
  onProgramDataRateChange: (dataRate: number) => void;
  programZoom?: ProgramZoomType;
  onZoomChange: (dx: number, dy: number, scale: number) => void;
  tileHeight?: number;
  tileId: string;
  //state
  programMode: ProgramMode;
  isPlaying: boolean;
  playBackIndex: number;
  recordIndex: number;
  //state handlers
  handleChangeOfProgramMode: () => void;
  handleChangeIsPlaying: () => void;
  updatePlayBackIndex: (update: string) => void;
  updateRecordIndex: (update: string) => void;
  numNodes: number;
  tileContent: DataflowContentModelType;
}

interface IState {
  editorContainerWidth: number;
  lastIntervalDuration: number;
}

const numSocket = new Rete.Socket("Number value");
const RETE_APP_IDENTIFIER = "dataflow@0.1.0";
export const MAX_NODE_VALUES = 16;
const MAX_ZOOM = 2;
const MIN_ZOOM = .1;

@inject("stores")
@observer
export class DataflowProgram extends BaseComponent<IProps, IState> {
  public static contextType = DocumentContextReact;

  private components: DataflowReteNodeFactory[];
  private toolDiv: HTMLElement | null;
  private channels: NodeChannelInfo[] = [];
  private intervalHandle: ReturnType<typeof setTimeout>;
  private lastIntervalTime: number;
  private programEditor: NodeEditor;
  private programEngine: Engine;
  private editorDomElement: HTMLElement | null;
  private disposers: IDisposer[] = [];
  private onSnapshotSetup = false;
  private processing = false;
  private reactElements: HTMLElement[] = [];
  private reactNodeElements = new Map<Node, HTMLElement>();

  constructor(props: IProps) {
    super(props);
    this.state = {
      editorContainerWidth: 0,
      lastIntervalDuration: 0,
    };
    this.lastIntervalTime = Date.now();

  }

  public render() {
    const { readOnly, documentProperties, numNodes, tileContent, programDataRate, onProgramDataRateChange,
            isPlaying, handleChangeIsPlaying, handleChangeOfProgramMode, programMode} = this.props;


    const editorClassForDisplayState = "full";
    const editorClass = `editor ${editorClassForDisplayState}`;
    const toolbarEditorContainerClass = `toolbar-editor-container`;
    const isTesting = ["qa", "test"].indexOf(this.stores.appMode) >= 0;
    const showRateUI = ["qa", "test", "dev"].indexOf(this.stores.appMode) >= 0;
    const showZoomControl = !documentProperties?.dfHasData;
    const disableToolBarModes = programMode === ProgramMode.Recording || programMode === ProgramMode.Done;
    const showProgramToolbar = showZoomControl && !disableToolBarModes;

    return (
      <div className="dataflow-program-container">
        <DataflowProgramTopbar
          onSerialRefreshDevices={this.serialDeviceRefresh}
          programDataRates={ProgramDataRates}
          dataRate={programDataRate}
          onRateSelectClick={onProgramDataRateChange}
          readOnly={!!readOnly}
          showRateUI={showRateUI}
          lastIntervalDuration={this.state.lastIntervalDuration}
          serialDevice={this.stores.serialDevice}
          programMode={programMode}
          isPlaying={isPlaying}
          handleChangeIsPlaying={handleChangeIsPlaying}
          numNodes={numNodes}
          tileContent={tileContent}
          handleChangeOfProgramMode={handleChangeOfProgramMode}
        />
        <div className={toolbarEditorContainerClass}>
          { showProgramToolbar && <DataflowProgramToolbar
            disabled={!!readOnly}
            isTesting={isTesting}
            onClearClick={this.clearProgram}
            onNodeCreateClick={this.addNode}
            tileId={this.props.tileId}
          /> }
          <DataflowDropZone
            addNode={this.addNode}
            className="editor-graph-container"
            programEditor={this.programEditor}
            style={this.getEditorStyle}
            tileId={this.props.tileId}
          >
            <div
              className={editorClass}
              ref={(elt) => this.editorDomElement = elt}
            >
              <div
                className="flow-tool"
                ref={elt => this.toolDiv = elt}
                onWheel={e => this.handleWheel(e, this.toolDiv) }
              />
              { this.shouldShowProgramCover() &&
                <DataflowProgramCover editorClass={editorClassForDisplayState} /> }
              {showZoomControl &&
                <DataflowProgramZoom
                  onZoomInClick={this.zoomIn}
                  onZoomOutClick={this.zoomOut}
                  disabled={false}
                /> }
            </div>
          </DataflowDropZone>
        </div>
      </div>
    );
  }

  private handleWheel(e: any, toolDiv: HTMLElement | null) {
    if (toolDiv !== null) {
      const documentContent = toolDiv.closest(".document-content");
      documentContent?.scrollBy(e.deltaX, e.deltaY);
    }
  }

  public componentDidMount() {
    if (!this.programEditor && this.toolDiv) {
      this.initProgram();
    }
    this.setupOnSnapshot();
  }

  public componentWillUnmount() {
    clearInterval(this.intervalHandle);
    this.disposers.forEach(disposer => disposer());
    this.destroyEditor();
  }

  public componentDidUpdate(prevProps: IProps) {
    if (this.programEditor && this.programEditor.view) {
      if (this.editorDomElement && this.state.editorContainerWidth !== this.editorDomElement.clientWidth) {
        this.setState({ editorContainerWidth: this.editorDomElement.clientWidth });
        this.programEditor.view.resize();
        this.keepNodesInView();
      } else if (this.props.size !== prevProps.size) {
        this.programEditor.view.resize();
        this.keepNodesInView();
      }
    }

    if (!this.programEditor && this.toolDiv) {
      this.initProgram();
    }

    if (this.props.programDataRate !== prevProps.programDataRate) {
      this.setDataRate(this.props.programDataRate);
    }

    this.setupOnSnapshot();
  }

  private getEditorStyle = () => {
    const style: React.CSSProperties = {};
    const documentElt = document.querySelector(".document-content");
    const kBottomResizeHandleHeight = 10;
    const kProgramTopbarHeight = 44;
    const topbarHeight = kProgramTopbarHeight;
    const editorHeight = documentElt
                         ? documentElt.clientHeight - topbarHeight - kBottomResizeHandleHeight
                         : 500;
    if (!this.props.tileHeight) {
      style.height = `${editorHeight}px`;
    }
    return style;
  };

  private initProgram = () => {
    this.initComponents();
    this.initProgramEngine();
    this.initProgramEditor(true);

    this.setDataRate(this.props.programDataRate);
  };

  private initComponents = () => {
    this.components = [new NumberReteNodeFactory(numSocket),
      new MathReteNodeFactory(numSocket),
      new TransformReteNodeFactory(numSocket),
      new ControlReteNodeFactory(numSocket),
      new LogicReteNodeFactory(numSocket),
      new SensorReteNodeFactory(numSocket),
      new DemoOutputReteNodeFactory(numSocket),
      new LiveOutputReteNodeFactory(numSocket),
      new GeneratorReteNodeFactory(numSocket),
      new TimerReteNodeFactory(numSocket)];
  };

  private initProgramEngine = () => {
    this.programEngine = new Rete.Engine(RETE_APP_IDENTIFIER);

    this.components.map(c => {
      this.programEngine.register(c);
    });
  };

  private initProgramEditor = (clearHistory = false) => {
    (async () => {
      if (!this.toolDiv) return;

      this.programEditor = new Rete.NodeEditor(RETE_APP_IDENTIFIER, this.toolDiv);
      this.programEditor.use(ConnectionPlugin);
      this.programEditor.use(ReactRenderPlugin);

      // Work around for cleaning up React components created
      // by the react-render-plugin. The other part of this is
      // in `destroyEditor`.
      this.programEditor.on("rendercontrol", ({el, control}) => {
        const extControl = control as any;
        if (!extControl.render || extControl.render === "react") {
          this.reactElements.push(el);
        }
      });

      this.programEditor.on("rendernode", ({ el, node, component, bindSocket, bindControl }) => {
        const extComponent = component as any;
        if (!extComponent.render || extComponent.render === "react") {
          this.reactElements.push(el);
          this.reactNodeElements.set(node, el);
        }
      });

      this.programEditor.on("noderemoved", node => {
        const el = this.reactNodeElements.get(node);
        if (el) {
          this.reactNodeElements.delete(node);
          this.reactElements = this.reactElements.filter(item => item !== el);

          // Remove all the controls inside of this node
          const childControls = el.getElementsByClassName("control");
          for (let i=0; i<childControls.length; i++) {
            const controlEl = childControls[i];
            if (controlEl instanceof HTMLElement && this.reactElements.indexOf(controlEl)) {
              this.reactElements = this.reactElements.filter(item => item !== controlEl);
              ReactDOM.unmountComponentAtNode(controlEl);
            }
          }
          ReactDOM.unmountComponentAtNode(el);
        }
      });
      // End of work around for cleaning up React components

      this.components.map(c => {
        this.programEditor.register(c);
      });

      const program = this.props.program?.snapshotForRete;
      if (program?.id) {
        if (!this.props.readOnly && clearHistory) {
          forEach(program.nodes, (n: Node) => {
            const recentValues = n.data.recentValues as Record<string, any>;
            if (recentValues) {
              forEach(Object.keys(recentValues), (v:string) => {
                recentValues[v] = [];
              });
            }
          });
        }

        await this.programEditor.fromJSON(program as any);
      }
      const { area } = this.programEditor.view;
      const { programZoom } = this.props;
      if (programZoom) {
        area.zoom(programZoom.scale, programZoom.dx, programZoom.dy, "wheel");
      }

      (this.programEditor as any).on("process noderemoved connectioncreated connectionremoved", () => {
        this.processAndSave();
        this.countSerialDataNodes(this.programEditor.nodes);
      });

      this.programEditor.on("nodecreated", node => {
        this.processAndSave();
        this.moveNodeToFront(node, true);

        node.meta.inTileWithId = this.props.tileId;
        dataflowLogEvent("nodecreated", node, this.props.tileId);
      });

      this.programEditor.on("selectnode", ( { node } ) => {
        this.moveNodeToFront(node, false);
        node.meta.inTileWithId = this.props.tileId;
      });

      this.programEditor.on("nodedraged", node => {
        this.props.onProgramChange(this.programEditor.toJSON());
      });

      // remove rete double click zoom
      this.programEditor.on("zoom", ({ source }) => {
        return false;
      });

      this.programEditor.on("translated", node => {
        const { transform } = this.programEditor.view.area;
        this.props.onZoomChange(transform.x, transform.y, transform.k);
      });

      // Can this be in a control with stores injected?
      if (!this.props.readOnly) {
        autorun(this.updateChannels);
      }

      this.programEditor.view.resize();
      this.programEditor.trigger("process");

      // Program changes are logged from here, except nodecreated, above
      this.programEditor.on("noderemoved", node => {
        dataflowLogEvent("noderemoved", node, this.props.tileId);
      });

      this.programEditor.on("connectioncreated", connection => {
        dataflowLogEvent("connectioncreated", connection, this.props.tileId);
      });

      this.programEditor.on("connectionremoved", connection => {
        dataflowLogEvent("connectionremoved", connection, this.props.tileId);
      });
    })();
  };

  private setupOnSnapshot() {
    if (!this.onSnapshotSetup) {
      if (this.props.program) {
        this.disposers.push(onSnapshot(this.props.program.nodes, snapshot => {
          if (this.props.readOnly) {
            this.updateProgramEditor();
          }
        }));
        this.onSnapshotSetup = true;
      }
    }
  }

  private destroyEditor() {
    this.reactElements.forEach(el => {
      ReactDOM.unmountComponentAtNode(el);
    });
    this.programEditor.destroy();
    this.reactElements = [];
    this.reactNodeElements.clear();
  }

  private updateProgramEditor = () => {
    // TODO: allow updates to write tiles for undo/redo
    if (this.toolDiv && this.props.readOnly) {
      if (this.programEditor) {
        // Clean up the old editor first
        this.destroyEditor();
      }
      this.toolDiv.innerHTML = "";
      this.initProgramEditor();
    }
  };

  private setDataRate = (rate: number) => {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
    this.intervalHandle = setInterval(() => this.tick(), rate);
  };

  private processAndSave = async () => {
    if (this.processing) {
      // If we're already processing, wait a few milliseconds and try again
      setTimeout(this.processAndSave, 5);
      return;
    }

    this.processing = true;
    try {
      await this.programEngine.abort();
      const programJSON = this.programEditor.toJSON();
      await this.programEngine.process(programJSON);
      this.props.onProgramChange(programJSON);
    } finally {
      this.processing = false;
    }
  };

  private updateChannels = () => {
    this.channels = [];
    this.channels = [...virtualSensorChannels, ...serialSensorChannels];
    this.countSerialDataNodes(this.programEditor.nodes);
    this.programEditor.nodes.forEach((node) => {
      if (node.name === "Sensor") {
        const sensorSelect = node.controls.get("sensorSelect") as SensorSelectControl;
        sensorSelect.setChannels(this.channels);
      }
      if (node.name === "Live Output"){
        const hubSelect = node.controls.get("hubSelect") as DropdownListControl;
        hubSelect.setChannels(this.channels);
      }
    });
  };

  private shouldShowProgramCover() {
    return this.props.readOnly || this.disabledRecordingStates();
  }

  //disable the right side when recordingMode in stop or clear
  private disabledRecordingStates(){
    const { programMode } = this.props;
    return ( programMode === ProgramMode.Recording || programMode === ProgramMode.Done);
  }

  private keepNodesInView = () => {
    const margin = 5;
    let { k } = this.programEditor.view.area.transform;
    const { container: { clientWidth, clientHeight }, area: { transform }} = this.programEditor.view;

    // If we're at zero scale but have any window to fill,
    // give a little scale so we can tell the program's proportions with a valid rect
    if (k === 0 && clientWidth > 0 && clientHeight > 0) {
      this.programEditor.view.area.transform = {k: .01, x: transform.x, y: transform.y};
      this.programEditor.view.area.update();
      k = this.programEditor.view.area.transform.k;
    }

    const rect = this.getBoundingRectOfNodes();

    if (rect?.isValid) {
      const widthQ = k * clientWidth / (rect.right + margin);
      const heightQ = k * clientHeight / (rect.bottom + margin);
      const newZoom = Math.min(widthQ, heightQ);

      const tooSmall = rect.width < (clientWidth * .25) || rect.height < (clientHeight * .25);
      const tooBig = newZoom < k && rect.right > 0 && newZoom > 0;

      if (tooSmall) {
        this.programEditor.view.area.transform = {k: .9, x: transform.x, y: transform.y};
        this.programEditor.view.area.update();
        return;
      }

      if (tooBig) {
        this.programEditor.view.area.transform = {k: newZoom, x: transform.x, y: transform.y};
        this.programEditor.view.area.update();
      }
    }
  };

  private getBoundingRectOfNode(n: Node): Rect | undefined {
    const { k } = this.programEditor.view.area.transform;
    const nodeView = this.programEditor.view.nodes.get(n);
    if (!nodeView) return;
    return scaleRect(new Rect(nodeView.node.position[0], nodeView.node.position[1],
                              nodeView.el.clientWidth, nodeView.el.clientHeight), k);
  }

  private getBoundingRectOfNodes(): Rect | undefined {
    let bounds: Rect | undefined;
    this.programEditor.nodes.forEach((n: Node) => {
      const nodeBounds = this.getBoundingRectOfNode(n);
      if (nodeBounds?.isValid) {
        bounds = bounds ? unionRect(bounds, nodeBounds) : nodeBounds;
      }
    });
    return bounds;
  }

  private addNode = async (nodeType: string, position?: [number, number]) => {
    const nodeFactory = this.programEditor.components.get(nodeType) as DataflowReteNodeFactory;
    const n1 = await nodeFactory!.createNode();
    n1.position = position ?? this.getNewNodePosition();
    this.programEditor.addNode(n1);
  };

  private getNewNodePosition = () => {
    const numNodes = this.programEditor.nodes.length;
    const kNodesPerColumn = 5;
    const kNodesPerRow = 4;
    const kColumnWidth = 200;
    const kRowHeight = 90;
    const kLeftMargin = 40;
    const kTopMargin = 5;
    const kColumnOffset = 15;
    const { k } = this.programEditor.view.area.transform;
    const nodePos: [number, number] =
      [kLeftMargin * (1 / k) + Math.floor((numNodes % (kNodesPerColumn * kNodesPerRow)) / kNodesPerColumn)
        * kColumnWidth + Math.floor(numNodes / (kNodesPerColumn * kNodesPerRow)) * kColumnOffset,
      kTopMargin + numNodes % kNodesPerColumn * kRowHeight];
    return nodePos;
  };

  private moveNodeToFront = (node: Node, newNode: boolean) => {
    const totalNodes = this.programEditor.nodes.length;
    const selectedNodeView = this.programEditor.view.nodes.get(node);
    let selectedNodeZ = 0;
    if (selectedNodeView) {
      selectedNodeZ = selectedNodeView.el.style.zIndex ? parseInt(selectedNodeView.el.style.zIndex, 10) : selectedNodeZ;
    }
    this.programEditor.nodes.forEach((n: Node) => {
      const nodeView = this.programEditor.view.nodes.get(n);
      if (nodeView) {
        if (node.id === n.id) {
          nodeView.el.style.zIndex = totalNodes.toString();
        } else if (nodeView.el.style.zIndex) {
          const nodeZ = parseInt(nodeView.el.style.zIndex, 10);
          if (nodeZ > selectedNodeZ && !newNode) {
            nodeView.el.style.zIndex = (nodeZ - 1).toString();
          }
        }
      }
    });
  };

  private serialDeviceRefresh = () => {
    if (!this.stores.serialDevice.hasPort()){
      this.stores.serialDevice.requestAndSetPort()
        .then(() => {
          this.stores.serialDevice.handleStream(this.channels);
        });
    }

    if (this.stores.serialDevice.hasPort()){
      // TODO - if necessary
      // https://web.dev/serial/#close-port
    }
  };

  private clearProgram = () => {
    this.programEditor.clear();
  };

  private recordCase = () => {
    const { recordIndex } = this.props;
    const { programDataRate, dataSet } = this.props.tileContent; //grab the program Sampling Rate to write TimeQuantized

    //Write case
    //Attributes look like  Time (quantized) as col 1 followed by all nodes
    const aCase: ICaseCreation = {};

    //Quantize and write time
    const timeQuantizedKey = dataSet.attributes[0].id;
    const recordTimeQuantized = (recordIndex * programDataRate) / 1000; //in seconds
    aCase[timeQuantizedKey] = recordTimeQuantized;

    //loop through attribute (nodes) and write each value
    this.programEditor.nodes.forEach((node, idx) => {
      const key = this.getAttributeIdForNode(idx);
      aCase[key] = node.data.nodeValue as string;
    });
    addCanonicalCasesToDataSet(this.props.tileContent.dataSet, [aCase]);
  };

  private getAttributeIdForNode = (nodeIndex: number) => {
    const { dataSet } = this.props.tileContent;
    // this function adds one to index to skip time attribute
    return dataSet.attributes[nodeIndex + 1].id;
  };

  private playbackNodesWithCaseData = (dataSet: any, playBackIndex: number) => {
    const currentCase = dataSet.getCaseAtIndex(playBackIndex);
    if (currentCase){
      const {__id__} = currentCase; //this is the id of the case we are looking at for each frame
      this.programEditor.nodes.forEach((node, idx) => { //update each node in the frame
        const attrId = this.getAttributeIdForNode(idx);
        const valueToSendToNode = dataSet.getValue(__id__, attrId) as number;
        let nodeControl;
        switch (node.name){
          case "Sensor":
            nodeControl = node.controls.get("nodeValue") as SensorValueControl;
            nodeControl.setValue(valueToSendToNode);
            break;
          case "Number":
            nodeControl = node.controls.get("nodeValue") as NumControl;
            nodeControl.setValue(valueToSendToNode);
            break;
          case "Generator":
            nodeControl = node.controls.get("nodeValue") as ValueControl;
            nodeControl.setValue(valueToSendToNode);
            break;
          case "Timer":
            nodeControl = node.controls.get("nodeValue") as ValueControl; //not working
            nodeControl.setValue(valueToSendToNode);
            break;
          case "Math":
            break;
          case "Logic":
            break;
          case "Transform":
            break;
          case "Control":
            break;
          case "Demo Output":
            nodeControl = node.controls.get("demoOutput") as DemoOutputControl;
            nodeControl.setValue(valueToSendToNode); //---> shows correct animation
            nodeControl = node.inputs.get("nodeValue")?.control as InputValueControl;
            nodeControl.setDisplayMessage(valueToSendToNode === 0 ? "off" : "on");
            break;
          case "Live Output":
            nodeControl = node.inputs.get("nodeValue")?.control as InputValueControl;
            nodeControl.setDisplayMessage(valueToSendToNode === 0 ? "off" : "on");
            break;
          default:
        }
      });
    }
  };

  private updateNodes = () => {
    const nodeProcessMap: { [name: string]: (n: Node) => void } = {
      Generator: this.updateGeneratorNode,
      Timer: this.updateTimerNode,
      Sensor: (n: Node) => {
        this.updateNodeChannelInfo(n);
        this.updateNodeSensorValue(n);
      },
      "Live Output": (n: Node) => {
        this.updateNodeChannelInfo(n);
        this.sendDataToSerialDevice(n);
      }
    };
    let processNeeded = false;
    this.programEditor.nodes.forEach((n: Node) => {
      const nodeProcess = nodeProcessMap[n.name];
      if (nodeProcess) {
        processNeeded = true;
        nodeProcess(n);
      }
      if (Object.prototype.hasOwnProperty.call(n.data, "nodeValue")) {
        this.updateNodeRecentValues(n);
      }
    });
    if (processNeeded) {
        // if we've updated values on 1 or more nodes (such as a generator),
        // we need to abort any current processing and reprocess all
        // nodes so current values are up to date
      (async () => {
        await this.programEngine.abort();
        await this.programEngine.process(this.programEditor.toJSON());
      })();
    }
  };

  private tick = () => {
    const { readOnly, tileContent: tileModel, playBackIndex, programMode,
            isPlaying, updateRecordIndex, updatePlayBackIndex } = this.props;

    const dataSet = tileModel.dataSet;
    const now = Date.now();
    this.setState({lastIntervalDuration: now - this.lastIntervalTime});
    this.lastIntervalTime = now;

    switch (programMode){
      case ProgramMode.Ready:
        this.updateNodes();
        break;
      case ProgramMode.Recording:
        if (!readOnly) this.recordCase(); //only record cases from right DF tiles
        this.updateNodes();
        updateRecordIndex(UpdateMode.Increment);
        break;
      case ProgramMode.Done:
        isPlaying && this.playbackNodesWithCaseData(dataSet, playBackIndex);
        isPlaying && updatePlayBackIndex(UpdateMode.Increment);
        !isPlaying && updatePlayBackIndex(UpdateMode.Reset);
        updateRecordIndex(UpdateMode.Reset);
        break;
    }
  };

  private passSerialStateToChannel(sd: SerialDevice, channel: NodeChannelInfo){
    if (sd.hasPort()){
      channel.serialConnected = true;
      const deviceMismatch = sd.deviceFamily !== channel.deviceFamily;
      const timeSinceActive = channel.usesSerial && channel.lastMessageRecievedAt
        ? Date.now() - channel.lastMessageRecievedAt: 0;
      channel.missing = deviceMismatch || timeSinceActive > 7000;
    }
    else {
      channel.serialConnected = false;
      channel.missing = true;
    }
  }

  private countSerialDataNodes(nodes: Node[]){
    // implementing with a "count" of 1 or 0 in case we need to count nodes in future
    let serialNodesCt = 0;

    nodes.forEach((n) => {
      const isLiveSensor = /fsr|emg|[th]-[abcd]/; // match ids any live sensor channels
      if(isLiveSensor.test(n.data.sensor as string)){
        serialNodesCt++;
      }
      //live output block will alert need for serial
      // only after connection to another node is made
      // this allows user to drag a block out and work on program before connecting
      if (n.name === "Live Output"){
        if(n.inputs.entries().next().value[1].connections.length > 0){
          serialNodesCt++;
        }
      }
    });
    // constraining all counts to 1 or 0 for now
    if (serialNodesCt > 0){
      this.stores.serialDevice.setSerialNodesCount(1);
    } else {
      this.stores.serialDevice.setSerialNodesCount(0);
    }

    if (serialNodesCt > 0 && !this.stores.serialDevice.hasPort()){
      this.postSerialModal();
    }
  }

  private sendDataToSerialDevice(n: Node){
    const isNumberOutput = isFinite(n.data.nodeValue as number);
    const { deviceFamily } = this.stores.serialDevice;

    if (deviceFamily === "arduino" && isNumberOutput){
      this.stores.serialDevice.writeToOutForBBGripper(n.data.nodeValue as number);
    }
    if (deviceFamily === "microbit"){
      const hubSelect = n.controls.get("hubSelect") as DropdownListControl;
      if (hubSelect.getChannels()){
        const relayType = hubSelect.getData("liveOutputType") as string;
        const hubId = hubSelect.getSelectionId();
        const state = n.data.nodeValue as number;
        this.stores.serialDevice.writeToOutForMicroBitRelayHub(state, hubId, relayType );
      }
    }
  }

  private postSerialModal(){
    const lastMsg = localStorage.getItem("last-connect-message");

    let alertMessage = "";

    const btnMsg = `
      Click the ⚡️ button on the upper left, then select your device in the popup.
      Devices differ, but it may contain the words "usbserial" or "usbmodem"`;

    if (lastMsg !== "connect" && this.stores.serialDevice.serialNodesCount > 0){
      alertMessage += `1. Connect the arduino or micro:bit to your computer.  2.${btnMsg}`;
    }

    // physical connection has been made but user action needed
    if (lastMsg === "connect"
        && !this.stores.serialDevice.hasPort()
        && this.stores.serialDevice.serialNodesCount > 0
    ){
      alertMessage += btnMsg;
    }

    if (!this.stores.serialDevice.serialModalShown){
      this.stores.ui.alert(alertMessage, "Program Requires Connection to External Device");
      this.stores.serialDevice.serialModalShown = true;
    }
  }

  private updateNodeChannelInfo = (n: Node) => {
    if (this.channels.length > 0 ){
      this.channels.filter(c => c.usesSerial).forEach((ch) => {
        this.passSerialStateToChannel(this.stores.serialDevice, ch);
      });
    }

    const sensorSelect = n.controls.get("sensorSelect") as SensorSelectControl;
    if (sensorSelect) {
      sensorSelect.setChannels(this.channels);
      (sensorSelect as any).update();
    }
  };

  private updateNodeSensorValue = (n: Node) => {

    const sensorSelect = n.controls.get("sensorSelect") as SensorSelectControl;

    if (sensorSelect) {
      const chInfo = this.channels.find(ci => ci.channelId === n.data.sensor);

      // update virtual sensors
      if (chInfo?.virtualValueMethod && chInfo.timeFactor) {
        const time = Math.floor(Date.now() / chInfo.timeFactor);
        chInfo.value = chInfo.virtualValueMethod(time);
      }

      if (chInfo && chInfo.value) {
        sensorSelect.setSensorValue(chInfo.value);
      } else {
        sensorSelect.setSensorValue(NaN);
      }
    }
  };

  private updateNodeRecentValues = (n: Node) => {
    const watchedValues = n.data.watchedValues as Record<string, any>;
    Object.keys(watchedValues).forEach((valueKey: string) => {
      const value: any = n.data[valueKey];
      let recentValue: NodeValue = {};

      // Store recentValue as object with unique keys for each value stored in node
      // Needed for node types that require more than a single value
      if (value === "number") {
        recentValue[valueKey] = { name: n.name, val: value };
      } else {
        recentValue = value;
      }

      const recentValues = n.data.recentValues as Record<string, any>;
      if (recentValues) {
        if (recentValues[valueKey]) {
          const newRecentValues: any = recentValues[valueKey];
          if (newRecentValues.length > MAX_NODE_VALUES) {
            newRecentValues.shift();
          }
          newRecentValues.push(recentValue);
          recentValues[valueKey] = newRecentValues;
        } else {
          recentValues[valueKey] = [recentValue];
        }
      } else {
        n.data.recentValues = {[valueKey]: [recentValue]};
      }

      if (n.data.watchedValues) {
        n.update();
      }
    });
  };

  private updateGeneratorNode = (n: Node) => {
    const generatorType = n.data.generatorType;
    const period = Number(n.data.period);
    const amplitude = Number(n.data.amplitude);
    const nodeGeneratorType = NodeGeneratorTypes.find(gt => gt.name === generatorType);
    if (nodeGeneratorType && period && amplitude) {
      const time = Date.now();
      // note: period is given in s, but we're passing in ms for time, need to adjust
      const val = nodeGeneratorType.method(time, period * 1000, amplitude);
      const nodeValue = n.controls.get("nodeValue") as NumControl;
      if (nodeValue) {
        nodeValue.setValue(val);
      }
    }
  };

  private updateTimerNode = (n: Node) => {
    const timeOn = Number(n.data.timeOn);
    const timeOff = Number(n.data.timeOff);
    if (timeOn && timeOff) {
      const time = Date.now();
      // note: time on/off is given in s, but we're passing in ms for time, need to adjust
      const val = NodeTimerInfo.method(time, timeOn * 1000, timeOff * 1000);
      const nodeValue = n.controls.get("nodeValue") as NumControl;
      if (nodeValue) {
        nodeValue.setValue(val);
      }
    }
  };

  private zoomIn = () => {
    const { k } = this.programEditor.view.area.transform;
    this.setZoom(Math.min(MAX_ZOOM, k + .05));
  };

  private zoomOut = () => {
    const { k } = this.programEditor.view.area.transform;
    this.setZoom(Math.max(MIN_ZOOM, k - .05));
  };

  private setZoom = (zoom: number) => {
    const currentTransform = this.programEditor.view.area.transform;
    this.programEditor.view.area.transform = {k: zoom, x: currentTransform.x, y: currentTransform.y};
    this.programEditor.view.area.update();
    const { transform } = this.programEditor.view.area;
    this.props.onZoomChange(transform.x, transform.y, transform.k);
  };
}
