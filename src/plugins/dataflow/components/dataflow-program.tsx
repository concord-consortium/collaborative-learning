import React from "react";
import ReactDOM from "react-dom";
import "regenerator-runtime/runtime";
import { forEach } from "lodash";
import { inject, observer } from "mobx-react";
import { IDisposer, onSnapshot } from "mobx-state-tree";
import { SizeMeProps } from "react-sizeme";
import Rete, { NodeEditor, Engine, Node } from "rete";
import ConnectionPlugin from "rete-connection-plugin";
import ReactRenderPlugin from "rete-react-render-plugin";

import { BaseComponent } from "../../../components/base";
import { ProgramZoomType, DataflowContentModelType } from "../model/dataflow-content";
import { DataflowProgramModelType } from "../model/dataflow-program-model";
import { kSimulatedChannelPrefix, simulatedChannel } from "../model/utilities/simulated-channel";
import { findOutputVariable } from "../model/utilities/simulated-output";
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
import { getHubSelect, getNodeDataEncoded, setLiveOutputOpts } from "../nodes/utilities/live-output-utilities";
import {
  sendDataToSerialDevice, sendDataToSimulatedOutput, updateNodeChannelInfo, updateGeneratorNode, updateNodeRecentValues,
  updateSensorNode, updateTimerNode
} from "../nodes/utilities/update-utilities";
import {
  getBoundingRectOfNodes, getInsertionOrder,
  getNewNodePosition, moveNodeToFront
} from "../nodes/utilities/view-utilities";
import { DataflowDropZone } from "./ui/dataflow-drop-zone";
import { DataflowProgramToolbar } from "./ui/dataflow-program-toolbar";
import { DataflowProgramTopbar } from "./ui/dataflow-program-topbar";
import { DataflowProgramCover } from "./ui/dataflow-program-cover";
import { DataflowProgramZoom } from "./ui/dataflow-program-zoom";
import { NodeChannelInfo, serialSensorChannels } from "../model/utilities/channel";
import { NodeType, NodeTypes, ProgramDataRates } from "../model/utilities/node";
import { calculatedRecentValues, runNodePlaybackUpdates,  } from "../utilities/playback-utils";
import { getAttributeIdForNode, recordCase } from "../model/utilities/recording-utilities";
import { virtualSensorChannels } from "../model/utilities/virtual-channel";
import { DocumentContextReact } from "../../../components/document/document-context";
import { dataflowLogEvent } from "../dataflow-logger";
import { ProgramMode, UpdateMode } from "./types/dataflow-tile-types";
import { ITileModel } from "../../../models/tiles/tile-model";
import { IDataSet } from "../../../models/data/data-set";

import "./dataflow-program.sass";


export interface IStartProgramParams {
  runId: string;
  startTime: number;
  endTime: number;
  hasData: boolean;
  title: string;
}

interface IProps extends SizeMeProps {
  documentProperties?: { [key: string]: string };
  model?: ITileModel;
  onProgramChange: (program: any) => void;
  onProgramDataRateChange: (dataRate: number) => void;
  onZoomChange: (dx: number, dy: number, scale: number) => void;
  program?: DataflowProgramModelType;
  programDataRate: number;
  programZoom?: ProgramZoomType;
  readOnly?: boolean;
  runnable?: boolean;
  tileHeight?: number;
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
  tileContent: DataflowContentModelType;
}

interface IState {
  editorContainerWidth: number;
  lastIntervalDuration: number;
}

const numSocket = new Rete.Socket("Number value");
const RETE_APP_IDENTIFIER = "dataflow@0.1.0";
const MAX_ZOOM = 2;
const MIN_ZOOM = .1;

@inject("stores")
@observer
export class DataflowProgram extends BaseComponent<IProps, IState> {
  public static contextType = DocumentContextReact;

  private components: DataflowReteNodeFactory[];
  private toolDiv: HTMLElement | null;
  private channels: NodeChannelInfo[] = [];
  private previousChannelIds = "";
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

  private get tileId() {
    return this.props.model?.id || "";
  }

  public render() {
    const { readOnly, documentProperties, tileContent, programDataRate, onProgramDataRateChange,
            isPlaying, playBackIndex, handleChangeIsPlaying, handleChangeOfProgramMode, programMode} = this.props;

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
          playBackIndex={playBackIndex}
          isPlaying={isPlaying}
          handleChangeIsPlaying={handleChangeIsPlaying}
          tileContent={tileContent}
          handleChangeOfProgramMode={handleChangeOfProgramMode}
        />
        <div className={toolbarEditorContainerClass}>
          { showProgramToolbar && <DataflowProgramToolbar
            disabled={!!readOnly}
            isTesting={isTesting}
            onClearClick={this.clearProgram}
            onNodeCreateClick={this.addNode}
            tileId={this.tileId}
          /> }
          <DataflowDropZone
            addNode={this.addNode}
            className="editor-graph-container"
            programEditor={this.programEditor}
            readOnly={readOnly}
            style={this.getEditorStyle}
            tileId={this.tileId}
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
        this.updateNodeNames();
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
        moveNodeToFront(this.programEditor, node, true);
        node.meta.inTileWithId = this.tileId;
        dataflowLogEvent("nodecreated", node, this.tileId);
      });

      this.programEditor.on("selectnode", ( { node } ) => {
        moveNodeToFront(this.programEditor, node, false);
        node.meta.inTileWithId = this.tileId;
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

      this.programEditor.view.resize();
      this.programEditor.trigger("process");

      // Program changes are logged from here, except nodecreated, above
      this.programEditor.on("noderemoved", node => {
        this.updateNodeNames();
        dataflowLogEvent("noderemoved", node, this.tileId);
      });

      this.programEditor.on("connectioncreated", connection => {
        dataflowLogEvent("connectioncreated", connection, this.tileId);
      });

      this.programEditor.on("connectionremoved", connection => {
        dataflowLogEvent("connectionremoved", connection, this.tileId);
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

  private updateNodeNames(){
    this.programEditor.nodes.forEach((node) => {
      const insertionOrder = getInsertionOrder(this.programEditor, node.id);
      const nodeType = NodeTypes.find( (n: NodeType) => n.name === node.name);
      const displayNameBase = nodeType ? nodeType.displayName : node.name;
      node.data.encodedDisplayName = displayNameBase + " " + insertionOrder + getNodeDataEncoded(node);
    });
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

  private get simulatedChannels() {
    return this.props.tileContent
      ? this.props.tileContent.inputVariables?.map(variable => simulatedChannel(variable)) ?? []
      : [];
  }

  private updateChannels = () => {
    const channels = [...virtualSensorChannels, ...this.simulatedChannels, ...serialSensorChannels];
    const channelIds = channels.map(c => c.channelId).join(",");
    if (channelIds !== this.previousChannelIds) {
      this.previousChannelIds = channelIds;
      this.channels = channels;
      this.countSerialDataNodes(this.programEditor.nodes);

      this.programEditor.nodes.forEach((node) => {
        if (node.name === "Sensor") {
          const sensorSelect = node.controls.get("sensorSelect") as SensorSelectControl;
          sensorSelect.setChannels(this.channels);
        }

        if (node.name === "Live Output"){
          const hubSelect = getHubSelect(node);
          hubSelect.setChannels(this.channels);
        }
      });
    }

    this.programEditor.nodes.forEach(node => {
      if (["Sensor", "Live Output"].includes(node.name)) {
        updateNodeChannelInfo(node, this.channels, this.stores.serialDevice);
      }
    });
  };

  private shouldShowProgramCover() {
    return this.props.readOnly || this.inDisabledRecordingState;
  }

  //disable the right side when recordingMode in stop or clear
  private get inDisabledRecordingState() {
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

    const rect = getBoundingRectOfNodes(this.programEditor);

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

  private addNode = async (nodeType: string, position?: [number, number]) => {
    const nodeFactory = this.programEditor.components.get(nodeType) as DataflowReteNodeFactory;
    const n1 = await nodeFactory!.createNode();
    n1.position = position ?? getNewNodePosition(this.programEditor);
    this.programEditor.addNode(n1);
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

  private playbackNodesWithCaseData = (dataSet: IDataSet, playBackIndex: number) => {
    const caseId = dataSet.getCaseAtIndex(playBackIndex)?.__id__;
    if (!caseId) return;
    this.programEditor.nodes.forEach((node, idx) => { //update each node in the frame
      const attrId = getAttributeIdForNode(this.props.tileContent.dataSet, idx);
      const valForNode = dataSet.getValue(caseId, attrId) as number;

      // each node needs to have a particular updates performed explicitly for playback
      runNodePlaybackUpdates(node, valForNode);
      node.data.recentValues = calculatedRecentValues(dataSet, playBackIndex, attrId);
      node.update();
    });
  };

  private updateNodes = () => {
    const nodeProcessMap: { [name: string]: (n: Node) => void } = {
      Generator: updateGeneratorNode,
      Timer: updateTimerNode,
      Sensor: (n: Node) => {
        updateSensorNode(n, this.channels);
      },
      "Live Output": (n: Node) => {
        const outputVar = findOutputVariable(n, this.props.tileContent?.outputVariables);
        const foundDeviceFamily = this.stores.serialDevice.deviceFamily ?? "unknown device";
        if (this.props.runnable) {
          sendDataToSerialDevice(n, this.stores.serialDevice);
          sendDataToSimulatedOutput(n, this.props.tileContent?.outputVariables);
        }
        setLiveOutputOpts(n, foundDeviceFamily, outputVar);
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
        updateNodeRecentValues(n);
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
    const { runnable, tileContent: tileModel, playBackIndex, programMode,
            isPlaying, updateRecordIndex, updatePlayBackIndex } = this.props;

    const dataSet = tileModel.dataSet;
    const now = Date.now();
    this.setState({lastIntervalDuration: now - this.lastIntervalTime});
    this.lastIntervalTime = now;

    this.updateChannels();

    switch (programMode){
      case ProgramMode.Ready:
        this.updateNodes();
        break;
      case ProgramMode.Recording:
        if (runnable) {
          recordCase(this.props.tileContent, this.programEditor, this.props.recordIndex);
        }
        this.updateNodes();
        updateRecordIndex(UpdateMode.Increment);
        break;
      case ProgramMode.Done:
        if (isPlaying) {
          this.playbackNodesWithCaseData(dataSet, playBackIndex);
          updatePlayBackIndex(UpdateMode.Increment);
        } else {
          updatePlayBackIndex(UpdateMode.Reset);
        }
        updateRecordIndex(UpdateMode.Reset);
        break;
    }
  };

  private countSerialDataNodes(nodes: Node[]){
    // implementing with a "count" of 1 or 0 in case we need to count nodes in future
    let serialNodesCt = 0;

    nodes.forEach((n) => {
      const isLiveSensor = /fsr|emg|tmp|[th]-[abcd]/; // match ids any live sensor channels
      const sensor = n.data.sensor as string;
      if(isLiveSensor.test(sensor) && !sensor.startsWith(kSimulatedChannelPrefix)){
        serialNodesCt++;
      }
      //live output block will alert need for serial
      // only after connection to another node is made
      // this allows user to drag a block out and work on program before connecting
      if (n.name === "Live Output"){
        // Don't count the node if it's connected to a shared output variable
        const outputVariable = findOutputVariable(n, this.props.tileContent?.outputVariables);
        if(!outputVariable && n.inputs.entries().next().value[1].connections.length > 0) {
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
