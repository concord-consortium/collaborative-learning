import "regenerator-runtime/runtime";
import { inject, observer } from "mobx-react";
import { BaseComponent } from "../../../components/base";
import React from "react";
import Rete, { NodeEditor, Engine, Node } from "rete";
import ConnectionPlugin from "rete-connection-plugin";
import ReactRenderPlugin from "rete-react-render-plugin";
import { autorun } from "mobx";
import { IDisposer, onSnapshot } from "mobx-state-tree";
import { SizeMeProps } from "react-sizeme";
import { forEach } from "lodash";
import { ProgramZoomType } from "../model/dataflow-content";
import { DataflowProgramModelType } from "../model/dataflow-program-model";
import { SensorSelectControl } from "../nodes/controls/sensor-select-control";
import { RelaySelectControl } from "../nodes/controls/relay-select-control";
import { DataflowReteNodeFactory } from "../nodes/factories/dataflow-rete-node-factory";
import { NumberReteNodeFactory } from "../nodes/factories/number-rete-node-factory";
import { MathReteNodeFactory } from "../nodes/factories/math-rete-node-factory";
import { TransformReteNodeFactory } from "../nodes/factories/transform-rete-node-factory";
import { ControlReteNodeFactory } from "../nodes/factories/control-rete-node-factory";
import { LogicReteNodeFactory } from "../nodes/factories/logic-rete-node-factory";
import { SensorReteNodeFactory } from "../nodes/factories/sensor-rete-node-factory";
import { RelayReteNodeFactory } from "../nodes/factories/relay-rete-node-factory";
import { DemoOutputReteNodeFactory } from "../nodes/factories/demo-output-rete-node-factory";
import { LiveOutputReteNodeFactory } from "../nodes/factories/live-output-rete-node-factory";
import { GeneratorReteNodeFactory } from "../nodes/factories/generator-rete-node-factory";
import { TimerReteNodeFactory } from "../nodes/factories/timer-rete-node-factory";
import { DataStorageReteNodeFactory } from "../nodes/factories/data-storage-rete-node-factory";
import { NumControl } from "../nodes/controls/num-control";
import { DataflowProgramToolbar } from "./ui/dataflow-program-toolbar";
import { DataflowProgramTopbar } from "./ui/dataflow-program-topbar";
import { DataflowProgramCover } from "./ui/dataflow-program-cover";
import { DataflowProgramZoom } from "./ui/dataflow-program-zoom";
import { NodeChannelInfo, NodeGeneratorTypes, ProgramDataRates, NodeTimerInfo,
         virtualSensorChannels, serialSensorChannels} from "../model/utilities/node";
import { Rect, scaleRect, unionRect } from "../utilities/rect";
import { DocumentContextReact } from "../../../components/document/document-context";
import { SerialDevice } from "../../../models/stores/serial";

import "./dataflow-program.sass";

interface NodeNameValuePair {
  name: string;
  val: number;
}
interface NodeValueMap {
  [key: string]: NodeNameValuePair;
}
type NodeValue = number | NodeValueMap;

enum ProgramRunStates {
  Ready,
  Running,
  Complete
}

export interface IStartProgramParams {
  runId: string;
  startTime: number;
  endTime: number;
  hasData: boolean;
  hasRelay: boolean;
  title: string;
}

interface IProps extends SizeMeProps {
  modelId: string;
  readOnly?: boolean;
  documentProperties?: { [key: string]: string };
  program?: DataflowProgramModelType;
  onProgramChange: (program: any) => void;
  programDataRate: number;
  onProgramDataRateChange: (dataRate: number) => void;
  programZoom?: ProgramZoomType;
  onZoomChange: (dx: number, dy: number, scale: number) => void;
  tileHeight?: number;
}

interface IState {
  disableDataStorage: boolean;
  programRunState: ProgramRunStates;
  editorContainerWidth: number;
  remainingTimeInSeconds: number;
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

  constructor(props: IProps) {
    super(props);
    this.state = {
      disableDataStorage: false,
      programRunState: ProgramRunStates.Ready,
      editorContainerWidth: 0,
      remainingTimeInSeconds: 0,
      lastIntervalDuration: 0,
    };
    this.lastIntervalTime = Date.now();
  }

  public render() {
    const { readOnly, documentProperties } = this.props;
    const editorClassForDisplayState = "full";
    const editorClass = `editor ${editorClassForDisplayState}`;
    const toolbarEditorContainerClass = `toolbar-editor-container`;
    const isTesting = ["qa", "test"].indexOf(this.stores.appMode) >= 0;
    const showRateUI = ["qa", "test", "dev"].indexOf(this.stores.appMode) >= 0;
    const showZoomControl = !documentProperties?.dfHasData && !documentProperties?.dfHasRelay;
    const showProgramToolbar = showZoomControl && !readOnly;
    return (
      <div className="dataflow-program-container">
        {this.isRunning() && <div className="running-indicator" />}
        <DataflowProgramTopbar
          onRefreshDevices={this.deviceRefresh}
          onSerialRefreshDevices={this.serialDeviceRefresh}
          programDataRates={ProgramDataRates}
          dataRate={this.props.programDataRate}
          onRateSelectClick={this.props.onProgramDataRateChange}
          isRunEnabled={this.isReady()}
          runningProgram={this.isRunning() && !readOnly}
          remainingTimeInSeconds={this.state.remainingTimeInSeconds}
          readOnly={readOnly || !this.isReady()}
          showRateUI={showRateUI}
          lastIntervalDuration={this.state.lastIntervalDuration}
          serialDevice={this.stores.serialDevice}
        />
        <div className={toolbarEditorContainerClass}>
          { showProgramToolbar && <DataflowProgramToolbar
            onNodeCreateClick={this.addNode}
            onClearClick={this.clearProgram}
            isTesting={isTesting}
            isDataStorageDisabled={this.state.disableDataStorage}
            disabled={readOnly || !this.isReady()}
          /> }
          <div
            className="editor-graph-container"
            style={this.getEditorStyle()}
            onDragOver={event => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={event => {
              event.preventDefault();
              const nodeType = event.dataTransfer.getData("text/plain");
              console.log(`Adding ${nodeType}`);
            }}
          >
            <div
              className={editorClass}
              ref={(elt) => this.editorDomElement = elt}
            >
              <div className="flow-tool" ref={elt => this.toolDiv = elt}/>
              { this.shouldShowProgramCover() &&
                <DataflowProgramCover editorClass={editorClassForDisplayState} /> }
              {showZoomControl &&
                <DataflowProgramZoom
                  onZoomInClick={this.zoomIn}
                  onZoomOutClick={this.zoomOut}
                  disabled={!this.isReady()}
                /> }
            </div>
          </div>
        </div>
      </div>
    );
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
      new RelayReteNodeFactory(numSocket),
      new DemoOutputReteNodeFactory(numSocket),
      new LiveOutputReteNodeFactory(numSocket),
      new GeneratorReteNodeFactory(numSocket),
      new TimerReteNodeFactory(numSocket),
      new DataStorageReteNodeFactory(numSocket)];
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
        if (this.hasDataStorage()) {
          this.setState({disableDataStorage: true});
        }
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
      });

      this.programEditor.on("selectnode", ( { node } ) => {
        this.moveNodeToFront(node, false);
      });

      this.programEditor.on("nodedraged", node => {
        this.props.onProgramChange(this.programEditor.toJSON());
      });

      this.programEditor.on("nodecreate", node => {
        // trigger after each of the first six events
        // add the current set of sensors or relays to node controls
        if (node.name === "Sensor") {
          const sensorSelect = node.controls.get("sensorSelect") as SensorSelectControl;
          sensorSelect.setChannels(this.channels);
        } else if (node.name === "Relay") {
          const relayList = node.controls.get("relayList") as RelaySelectControl;
          relayList.setChannels(this.channels);
        }
        return true;
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

  private updateProgramEditor = () => {
    // TODO: allow updates to write tiles for undo/redo
    if (this.toolDiv && this.props.readOnly) {
      this.toolDiv.innerHTML = "";
      this.initProgramEditor();
    }
  };

  private setDataRate = (rate: number) => {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
    this.intervalHandle = setInterval(this.tick, rate);
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
      if (!this.hasDataStorage()) {
        this.setState({disableDataStorage: false});
      }
      this.props.onProgramChange(programJSON);
    } finally {
      this.processing = false;
    }
  };

  private updateChannels = () => {
    this.channels = [];
    this.channels = [...virtualSensorChannels, ...serialSensorChannels];
    this.countSerialDataNodes(this.programEditor.nodes);
  };

  private isReady = () => {
    return (this.state.programRunState === ProgramRunStates.Ready);
  };

  private isRunning = () => {
    return (this.state.programRunState === ProgramRunStates.Running);
  };

  private shouldShowProgramCover() {
    return this.props.readOnly;
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

  private addNode = async (nodeType: string) => {
    const nodeFactory = this.programEditor.components.get(nodeType) as DataflowReteNodeFactory;
    const n1 = await nodeFactory!.createNode();
    n1.position = this.getNewNodePosition();
    this.programEditor.addNode(n1);
    if (nodeType === "Data Storage") {
      this.setState({disableDataStorage: true});
    }
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

  private deviceRefresh = () => {   // FIXME
    // const message =
    //     "Refresh will update the list of sensor and relay devices that appear in the block selection menus. \
    //      Please wait 5-10 seconds for refresh to complete. \
    //      If your device does not appear in the block selection after refresh, \
    //      check if the device is plugged in and the hub is turned on.";
    // this.stores.ui.confirm(message, "Refresh Sensors and Relays?")
    // .then(ok => {
    //   if (ok) {
    //     const { iot } = this.stores;
    //     iot.refreshAllHubsChannelInfo();
    //   }
    // });
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
    this.setState({disableDataStorage: false});
  };

  private hasDataStorage() {
    return this.getNodeCount("Data Storage") > 0;
  }

  private hasRelay() {
    return this.getNodeCount("Relay") > 0;
  }

  private hasDemoOutput() {
    return this.getNodeCount("Demo Output") > 0;
  }

  private hasLiveOutput(){
    return this.getNodeCount("Live Output") > 0;
  }

  private getNodeCount = (type?: string) => {
    return (type ? this.programEditor.nodes.filter(n => (n.name === type)).length : this.programEditor.nodes.length);
  };

  private tick = () => {
    // Update the sampling rate
    const now = Date.now();
    this.setState({lastIntervalDuration: now - this.lastIntervalTime});
    this.lastIntervalTime = now;

    const nodeProcessMap: { [name: string]: (n: Node) => void } = {
            Generator: this.updateGeneratorNode,
            Timer: this.updateTimerNode,
            Sensor: (n: Node) => {
                      this.updateNodeChannelInfo(n);
                      this.updateNodeSensorValue(n);
                    },
            "Live Output": (n: Node) => {
              this.sendDataToSerialDevice(n);
            },
            Relay: this.updateNodeChannelInfo
          };

    let processNeeded = false;

    this.programEditor.nodes.forEach((n: Node) => {
      const nodeProcess = nodeProcessMap[n.name];
      if (nodeProcess) {
        processNeeded = true;
        nodeProcess(n);
      }
      // TODO: We probably need a better way to determine if recentValues should be updated
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

  private passSerialStateToChannel(sd: SerialDevice, channel: NodeChannelInfo){
    if (sd.hasPort()){
      channel.serialConnected = true;
      channel.missing = false;
    } else {
      channel.serialConnected = false;
      channel.missing = true;
    }
  }

  private countSerialDataNodes(nodes: Node[]){
    // implementing with a "count" of 1 or 0 in case we need to count nodes in future
    let serialNodesCt = 0;

    //sensor will need serial once these particular sensors are chosen
    nodes.forEach((n) => {
      if(n.data.sensor === "emg" || n.data.sensor === "fsr"){
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
    if (isFinite(n.data.nodeValue as number)){
      this.stores.serialDevice.writeToOut(n.data.nodeValue as number);
    }
  }

  private postSerialModal(){
    const lastMsg = localStorage.getItem('last-connect-message');

    let alertMessage = "";
    const btnMsg = "Click the ⚡️ button on the upper left, then choose the device at the prompt.";

    // no physical connection
    if (lastMsg !== "connect" && this.stores.serialDevice.serialNodesCount > 0){
      alertMessage += `1. Connect the arduino to your computer.  2.${btnMsg}`;
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
    const relayList = n.controls.get("relayList") as RelaySelectControl;
    if (sensorSelect) {
      sensorSelect.setChannels(this.channels);
      (sensorSelect as any).update();
    }
    if (relayList) {
      relayList.setChannels(this.channels);
      (relayList as any).update();
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
      // Needed for node types such as data storage that require more than a single value
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
