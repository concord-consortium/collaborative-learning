import "regenerator-runtime/runtime";
import { inject, observer } from "mobx-react";
import { BaseComponent } from "../../../components/base";
import React from "react";
import Rete, { NodeEditor, Node, Input } from "rete";
import ConnectionPlugin from "rete-connection-plugin";
import ReactRenderPlugin from "rete-react-render-plugin";
import { autorun } from "mobx";
import { getSnapshot, IDisposer, onSnapshot } from "mobx-state-tree";
import { SizeMeProps } from "react-sizeme";
import { forEach, cloneDeep } from "lodash";
import { ProgramZoomType } from "../model/dataflow-content";
import { SensorSelectControl } from "../nodes/controls/sensor-select-control";
import { RelaySelectControl } from "../nodes/controls/relay-select-control";
import { NumberReteNodeFactory } from "../nodes/factories/number-rete-node-factory";
import { MathReteNodeFactory } from "../nodes/factories/math-rete-node-factory";
import { TransformReteNodeFactory } from "../nodes/factories/transform-rete-node-factory";
import { LogicReteNodeFactory } from "../nodes/factories/logic-rete-node-factory";
import { SensorReteNodeFactory } from "../nodes/factories/sensor-rete-node-factory";
import { RelayReteNodeFactory } from "../nodes/factories/relay-rete-node-factory";
import { LightBulbReteNodeFactory } from "../nodes/factories/light-bulb-rete-node-factory";
import { GeneratorReteNodeFactory } from "../nodes/factories/generator-rete-node-factory";
import { TimerReteNodeFactory } from "../nodes/factories/timer-rete-node-factory";
import { DataStorageReteNodeFactory } from "../nodes/factories/data-storage-rete-node-factory";
import { PlotButtonControl } from "../nodes/controls/plot-button-control";
import { NumControl } from "../nodes/controls/num-control";
import { DropdownListControl, ListOption } from "../nodes/controls/dropdown-list-control";
import { DataflowOpenProgramButton } from "./ui/dataflow-open-program-button";
import { DataflowProgramToolbar } from "./ui/dataflow-program-toolbar";
import { DataflowProgramTopbar } from "./ui/dataflow-program-topbar";
import { DataflowProgramCover } from "./ui/dataflow-program-cover";
import { DataflowProgramZoom } from "./ui/dataflow-program-zoom";
import { DataflowProgramGraph,DataSet, ProgramDisplayStates } from "./ui/dataflow-program-graph";
// import { uploadProgram, fetchProgramData, fetchActiveRelays, deleteProgram } from "../utilities/aws";
import { NodeChannelInfo, NodeSensorTypes, NodeGeneratorTypes, ProgramDataRates, NodeTimerInfo,
         IntervalTimes, virtualSensorChannels } from "../model/utilities/node";
import { Rect, scaleRect, unionRect } from "../utilities/rect";
import { DocumentContextReact } from "../../../components/document/document-context";

import "./dataflow-program.sass";

interface NodeNameValuePair {
  name: string;
  val: number;
}
interface NodeValueMap {
  [key: string]: NodeNameValuePair;
}
type NodeValue = number | NodeValueMap;

interface NodeSequenceNameMap {
  [key: number]: string;
}
interface NodeSequenceUnitsMap {
  [key: number]: string;
}

interface MissingDevice {
  id: string;
  type: string;
}

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
  program?: any;
  onProgramChange: (program: any) => void;
  onShowOriginalProgram?: () => void;
  onStartProgram: (params: IStartProgramParams) => void;
  programRunId: string;
  onSetProgramStartTime: (time: number) => void;
  programStartTime: number;
  onSetProgramEndTime: (time: number) => void;
  programEndTime: number;
  onSetProgramStartEndTime: (startTime: number, endTime: number) => void;
  programDataRate: number;
  onProgramDataRateChange: (dataRate: number) => void;
  programZoom?: ProgramZoomType;
  onZoomChange: (dx: number, dy: number, scale: number) => void;
  programIsRunning?: string;
  onCheckProgramRunState: (endTime: number) => void;
  tileHeight?: number;
}

interface IState {
  disableDataStorage: boolean;
  programRunState: ProgramRunStates;
  programDisplayState: ProgramDisplayStates;
  graphDataSet: DataSet;
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

  private components: any[];
  private toolDiv: HTMLElement | null;
  private channels: NodeChannelInfo[] = [];
  private sequenceNames: NodeSequenceNameMap;
  private sequenceUnits: NodeSequenceUnitsMap;
  private intervalHandle: any;
  private lastIntervalTime: number;
  private programEditor: NodeEditor;
  private programEngine: any;
  private editorDomElement: HTMLElement | null;
  private _isMounted: boolean;
  private disposers: IDisposer[] = [];
  private processing = false;

  constructor(props: IProps) {
    super(props);
    this.state = {
      disableDataStorage: false,
      programRunState: ProgramRunStates.Ready,
      graphDataSet: { sequences: [], startTime: 0, endTime: 0 },
      editorContainerWidth: 0,
      programDisplayState: ProgramDisplayStates.Program,
      remainingTimeInSeconds: 0,
      lastIntervalDuration: 0,
    };
    this.lastIntervalTime = Date.now();
  }

  public render() {
    const { readOnly, documentProperties, onShowOriginalProgram } = this.props;
    const editorClassForDisplayState = this.getEditorClassForDisplayState();
    const editorClass = `editor ${editorClassForDisplayState}`;
    const toolbarEditorContainerClass = `toolbar-editor-container ${(this.isComplete() && "complete")}`;
    const isTesting = ["qa", "test"].indexOf(this.stores.appMode) >= 0;
    const showRateUI = ["qa", "test", "dev"].indexOf(this.stores.appMode) >= 0;
    const showZoomControl = (this.state.programDisplayState === ProgramDisplayStates.Program) &&
                                !documentProperties?.dfHasData && !documentProperties?.dfHasRelay;
    const showProgramToolbar = showZoomControl && !readOnly;
    return (
      <div className="dataflow-program-container">
        {this.isRunning() && <div className="running-indicator" />}
        {!this.isComplete() && <DataflowProgramTopbar
          onRunProgramClick={this.prepareToRunProgram}
          onStopProgramClick={this.stopProgram}
          onRefreshDevices={this.deviceRefresh}
          programDataRates={ProgramDataRates}
          dataRate={this.props.programDataRate}
          onRateSelectClick={this.props.onProgramDataRateChange}
          isRunEnabled={this.isReady()}
          runningProgram={this.isRunning() && !readOnly}
          remainingTimeInSeconds={this.state.remainingTimeInSeconds}
          readOnly={readOnly || !this.isReady()}
          showRateUI={showRateUI}
          lastIntervalDuration={this.state.lastIntervalDuration}
        />}
        <div className={toolbarEditorContainerClass}>
          { showProgramToolbar && <DataflowProgramToolbar
            onNodeCreateClick={this.addNode}
            onResetClick={this.resetNodes}
            onClearClick={this.clearProgram}
            isTesting={isTesting}
            isDataStorageDisabled={this.state.disableDataStorage}
            disabled={readOnly || !this.isReady()}
          /> }
          <div className="editor-graph-container" style={this.getEditorStyle()}>
            <div
              className={editorClass}
              ref={(elt) => this.editorDomElement = elt}
            >
              <div className="flow-tool" ref={elt => this.toolDiv = elt}/>
              { this.shouldShowProgramCover() &&
                <DataflowProgramCover editorClass={editorClassForDisplayState} isRunning={this.isRunning()} /> }
              {showZoomControl &&
                <DataflowProgramZoom
                  onZoomInClick={this.zoomIn}
                  onZoomOutClick={this.zoomOut}
                  disabled={!this.isReady()}
                /> }
            </div>
            {this.isProgramOnly() && onShowOriginalProgram &&
              <DataflowOpenProgramButton className="program-editor" onClick={onShowOriginalProgram} /> }
            {!this.isProgramOnly() &&
              <DataflowProgramGraph
                dataSet={this.state.graphDataSet}
                programDisplayState={this.state.programDisplayState}
                onClickSplitLeft={this.handleClickSplitLeft}
                onClickSplitRight={this.handleClickSplitRight}
                onShowOriginalProgram={onShowOriginalProgram}
              /> }
          </div>
        </div>
      </div>
    );
  }

  public componentDidMount() {
    this._isMounted = true;
    if (!this.programEditor && this.toolDiv) {
      this.initProgram();
    }
    if (this.isComplete()) {
      this.props.onCheckProgramRunState(this.props.programEndTime);
    }
    
    if (this.props.program) {
      this.disposers.push(onSnapshot(this.props.program.nodes, snapshot => {
        if (this.props.readOnly) {
          this.updateProgramEditor();
        }
      }));
    }
  }

  public componentWillUnmount() {
    clearInterval(this.intervalHandle);

    this.disposers.forEach(disposer => disposer());

    this._isMounted = false;
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

      if ((this.props.modelId !== prevProps.modelId) ||
          (this.props.programRunId !== prevProps.programRunId)) {
        this.updateRunAndGraphStates();
      }
      this.updateDisabledIntervals();
    }

    if (!this.programEditor && this.toolDiv) {
      this.initProgram();
    }

    if (this.props.programDataRate !== prevProps.programDataRate) {
      this.setDataRate(this.props.programDataRate);
    }
  }

  private getEditorStyle = () => {
    const style: React.CSSProperties = {};
    const documentElt = document.querySelector(".document-content");
    const kBottomResizeHandleHeight = 10;
    const kProgramTopbarHeight = 44;
    const topbarHeight = this.isComplete() ? 0 : kProgramTopbarHeight;
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

    if (!this.isComplete() || this.props.programIsRunning === "true") {
      this.setDataRate(this.props.programDataRate);
    }
  };

  private initComponents = () => {
    this.components = [new NumberReteNodeFactory(numSocket),
      new MathReteNodeFactory(numSocket),
      new TransformReteNodeFactory(numSocket),
      new LogicReteNodeFactory(numSocket),
      new SensorReteNodeFactory(numSocket),
      new RelayReteNodeFactory(numSocket),
      new LightBulbReteNodeFactory(numSocket),
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

      const program = this.props.program && cloneDeep(getSnapshot(this.props.program));
      if (program && program.id) {
        if (!this.props.readOnly && clearHistory) {
          forEach(program.nodes, (n: any) => {
            if (n.data.recentValues) {
              n.data.recentValues = [];
            }
          });
        }
        
        // TODO: Can this line be removed?
        // this.closeCompletedRunProgramNodePlots(program);
        await this.programEditor.fromJSON(cloneDeep(program));
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

      this.updateRunAndGraphStates();
    })();
  };

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
    await this.programEngine.abort();
    const programJSON = this.programEditor.toJSON();
    await this.programEngine.process(programJSON);
    if (!this.hasDataStorage()) {
      this.setState({disableDataStorage: false});
    }
    this.props.onProgramChange(programJSON);
    this.processing = false;
  };

  private updateChannels = () => {
    // const { hubStore } = this.stores; FIXME
    this.channels = [];

    // function parseValue(value: string) {
    //   const chValue = Number.parseFloat(value);
    //   return Number.isFinite(chValue) ? chValue : NaN;
    // }

    // add virtual channels that always appear
    this.channels = [...virtualSensorChannels];

    // hubStore.hubs.forEach(hub => {
    //   hub.hubChannels.forEach(ch => {
    //     // add channel if it is new
    //     let chInfo = this.channels.find(ci => ci.channelId === ch.id);
    //     if (!chInfo || (chInfo.hubId !== hub.hubId)) {
    //       chInfo = {hubId: hub.hubId,
    //                 hubName: hub.hubName,
    //                 channelId: ch.id,
    //                 missing: ch.missing,
    //                 type: ch.type,
    //                 units: ch.units,
    //                 plug: ch.plug,
    //                 name: ch.type,
    //                 value: parseValue(ch.value)};
    //       this.channels.push(chInfo);
    //     }
    //   });
    // });
  };

  private updateRunAndGraphStates() {
    const programRunState: ProgramRunStates = this.getRunState();
    const hasDataStorage = this.hasDataStorage();
    const programDisplayState = (programRunState !== ProgramRunStates.Ready) && hasDataStorage
                                  ? programRunState === ProgramRunStates.Running
                                                        ? ProgramDisplayStates.SideBySide
                                                        : ProgramDisplayStates.Graph
                                  : ProgramDisplayStates.Program;
    const remainingTimeInSeconds = programRunState === ProgramRunStates.Running
                                    ? Math.max(0, Math.round((this.props.programEndTime - Date.now()) / 1000))
                                    : 0;
    this.setState({ programRunState, programDisplayState, remainingTimeInSeconds });
    this.updateGraphDataSet();
    const sequenceInfo = this.getNodeSequenceNamesAndUnits();
    this.sequenceNames = sequenceInfo.names;
    this.sequenceUnits = sequenceInfo.units;
  }

  private updateDisabledIntervals() {
    // const dataStorage = this.programEditor.nodes.find(n => n.name === "Data Storage");
    // if (dataStorage) {
    //   const intervalControl = dataStorage.controls.get("interval") as DropdownListControl;
    //   intervalControl.setDisabledFunction((option: ListOption) => {
    //     const interval = IntervalTimes.find(i => option.val === i.val);
    //     if (interval && this.props.programRunTime > interval.maxProgramRunTime) {
    //       return true;
    //     }
    //     return option.val! >= this.props.programRunTime;
    //   });
    // }
    return true;
  }

  private getRunState = () => {
    if (this.props.programRunId) {
      return (this.props.programEndTime > Date.now() ? ProgramRunStates.Running : ProgramRunStates.Complete);
    } else {
      return ProgramRunStates.Ready;
    }
  };

  private isReady = () => {
    return (this.state.programRunState === ProgramRunStates.Ready);
  };

  private isRunning = () => {
    return (this.state.programRunState === ProgramRunStates.Running);
  };

  private isComplete = () => {
    return (this.state.programRunState === ProgramRunStates.Complete);
  };

  private isProgramOnly = () => {
    return (this.state.programDisplayState === ProgramDisplayStates.Program);
  };

  private isGraphOnly = () => {
    return (this.state.programDisplayState === ProgramDisplayStates.Graph);
  };

  private isSideBySide = () => {
    return (this.state.programDisplayState === ProgramDisplayStates.SideBySide);
  };

  private getEditorClassForDisplayState() {
    return {
      [ProgramDisplayStates.Program]: "full",
      [ProgramDisplayStates.SideBySide]: "half",
      [ProgramDisplayStates.Graph80]: "some",
      [ProgramDisplayStates.Graph]: "hidden"
    }[this.state.programDisplayState];
  }

  private shouldShowProgramCover() {
    switch (this.state.programDisplayState) {
      case ProgramDisplayStates.Program:
        return this.props.readOnly || !this.isReady();
      case ProgramDisplayStates.Graph:
        return false;
    }
    return true;
  }

  private setProgramDisplayState(programDisplayState: ProgramDisplayStates) {
    this.setState({programDisplayState});
    // process is needed or rete doesn't redraw node connections when showing editor
    (async () => {
      await this.programEngine.abort();
      await this.programEngine.process(this.programEditor.toJSON());
    })();
  }

  private handleClickSplitLeft = () => {
    const programDisplayState = {
            [ProgramDisplayStates.Program]: ProgramDisplayStates.SideBySide,
            // [ProgramDisplayStates.SideBySide]: ProgramDisplayStates.Graph80, // disable 80/20 view for now
            [ProgramDisplayStates.SideBySide]: ProgramDisplayStates.Graph,
            [ProgramDisplayStates.Graph80]: ProgramDisplayStates.Graph,
            [ProgramDisplayStates.Graph]: ProgramDisplayStates.Graph
          }[this.state.programDisplayState];
    this.setProgramDisplayState(programDisplayState);
  };

  private handleClickSplitRight = () => {
    const programDisplayState = {
            [ProgramDisplayStates.Graph]: ProgramDisplayStates.SideBySide,
            // [ProgramDisplayStates.Graph]: ProgramDisplayStates.Graph80,  // disable 80/20 view for now
            [ProgramDisplayStates.Graph80]: ProgramDisplayStates.SideBySide,
            [ProgramDisplayStates.SideBySide]: ProgramDisplayStates.SideBySide,
            [ProgramDisplayStates.Program]: ProgramDisplayStates.Program
          }[this.state.programDisplayState];
    this.setProgramDisplayState(programDisplayState);
  };

  private keepNodesInView = () => {
    const margin = 5;
    const { k } = this.programEditor.view.area.transform;
    const rect = this.getBoundingRectOfNodes();
    if (rect?.isValid) {
      const newZoom = Math.min(k * this.programEditor.view.container.clientWidth / ( rect.right + margin),
                               k * this.programEditor.view.container.clientHeight / ( rect.bottom + margin));
      if (newZoom < k && rect.right > 0 && newZoom > 0) {
        const currentTransform = this.programEditor.view.area.transform;
        this.programEditor.view.area.transform = {k: newZoom, x: currentTransform.x, y: currentTransform.y};
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

  private hasValidOutputNodes = () => {
    const { ui } = this.stores;
    const hasRelay = this.hasRelay();
    const hasDataStorage = this.hasDataStorage();
    const hasLightbulb = this.hasLightbulb();
    let hasValidRelay = false;
    let hasValidDataStorage = false;
    if (hasRelay || hasDataStorage) {
      this.programEditor.nodes.forEach((n: Node) => {
        if (n.name === "Relay" && n.data.recentValues) {
          const input = n.inputs.get(Array.from(n.inputs.keys())[0]);
          const inputNode = input && input.connections[0] && input.connections[0].output.node;
          const recentVals: any = inputNode && inputNode.data.recentValues;
          if (recentVals && isFinite(recentVals[recentVals.length - 1].nodeValue.val) && n.data.relayList !== "none") {
            hasValidRelay = true;
          }
        } else if (n.name === "Data Storage") {
          if (n.inputs.size > 1) {
            const recentValues: any = n.data.recentValues;
            const lastValue = recentValues[recentValues.length - 1];
            forEach(lastValue, (value: any) => {
              if (isFinite(value.val)) {
                hasValidDataStorage = true;
              }
            });
          }
        }
      });
    }
    if (!hasRelay && !hasDataStorage && !hasLightbulb) {
      ui.alert(
        "Program must contain a Relay, Light Bulb, or Data Storage block before it can be run.", "No Program Output"
      );
      return false;
    } else if (!hasValidRelay && !hasValidDataStorage && !hasLightbulb) {
      const relayMessage = hasRelay && !hasValidRelay
                            ? "Relay blocks need a valid selected relay and valid input before the program can be run. "
                            : "";
      const dataStorageMessage = hasDataStorage && !hasValidDataStorage
                            ? "Data Storage blocks need a valid data input before the program can be run. "
                            : "";
      ui.alert(relayMessage + dataStorageMessage, "Invalid Program Output");
      return false;
    }
    return true;
  };

  private checkActiveRelaysAndRunProgram = () => {
    // const { ui } = this.stores;  FIXME
    // fetchActiveRelays().then((result: any) => {
    //   if (result.relays) {
    //       let relayInUse = false;
    //       this.programEditor.nodes.forEach((n: Node) => {
    //         if (n.name === "Relay" && n.data.relayList) {
    //           if (result.relays.includes(n.data.relayList)) {
    //             relayInUse = true;
    //           }
    //         }
    //       });
    //       if (relayInUse) {
    //         ui.alert("A selected relay is already in use. \
    //           Verify that you have selected the correct relay. \
    //           To run this program, update your program with an \
    //           available relay or wait until this relay becomes available.", "Relay In Use");
    //         return;
    //       }
    //   }
    //   this.checkDevicesAndRunProgram();
    // });
  };

  private hasValidInputNodes = () => {
    const missingDevices: MissingDevice[] = [];
    this.programEditor.nodes.forEach((n: Node) => {
      if (n.name === "Sensor" && n.data.sensor) {
        const chInfo = this.channels.find(ci => ci.channelId === n.data.sensor);
        if ((!chInfo && n.data.sensor !== "none") || (chInfo && chInfo.missing)) {
          if (typeof n.data.sensor === "string" && typeof n.data.type === "string") {
            missingDevices.push({ id: n.data.sensor, type: n.data.type});
          }
        }
      } else if (n.name === "Relay" && n.data.relayList) {
        const chInfo = this.channels.find(ci => ci.channelId === n.data.relayList);
        if ((!chInfo && n.data.relayList !== "none") || (chInfo && chInfo.missing)) {
          if (typeof n.data.relayList === "string") {
            missingDevices.push({ id: n.data.relayList, type: "relay"});
          }
        }
      }
    });
    return missingDevices;
  };

  private prepareToRunProgram = () => {
    if (!this.hasValidOutputNodes()) {
      return;
    }
    this.checkActiveRelaysAndRunProgram();
  };
  private checkDevicesAndRunProgram = () => {
    const missingDevices = this.hasValidInputNodes();
    if (missingDevices.length) {
      let message = "";
      missingDevices.forEach((md) => {
        const upperType = md.type.charAt(0).toUpperCase() + md.type.substring(1);
        message = message + (md.type === "relay"
          ? `Relay "${md.id}" cannot be found. `
          : `${upperType} sensor "${md.id}" cannot be found. `);
      });
      message = message + "Do you still want to run this program?";
      this.stores.ui.confirm(message, "Devices cannot be found")
      .then(ok => {
        if (ok) {
          this.requestNameAndRunProgram();
        }
      });
    } else {
      this.requestNameAndRunProgram();
    }
  };

  private requestNameAndRunProgram = () => {
    const dialogPrompt = this.hasDataStorage()
                          ? "Save dataset as"
                          : "Save program as";
    const programTitle = this.getDatasetName() || this.context?.title || "program";
    this.stores.ui.prompt(dialogPrompt, programTitle, "Run Program")
    .then((title: string) => {
      this.runProgram(title);
    });
  };

  private closeCompletedRunProgramNodePlots = (program: any) => {
    if (this.props.programRunId && (this.getRunState() === ProgramRunStates.Complete)) {
      forEach(program.nodes, (node: any) => { node.data?.plot && (node.data.plot = false); });
    }
  };

  private closeEditorNodePlots = () => {
    this.programEditor.nodes.forEach((n: Node) => {
      const plotControl = n.controls.get("plot") as PlotButtonControl;
      if (plotControl) {
        plotControl.setGraph(false);
      }
    });
  };

  private runProgram = (programTitle: string) => {    // FIXME
    // const programData: any = this.generateProgramData(programTitle);
    // uploadProgram(programData);
    // const sequenceInfo = this.getNodeSequenceNamesAndUnits();
    // this.sequenceNames = sequenceInfo.names;
    // this.sequenceUnits = sequenceInfo.units;
    // this.setState({programRunState: ProgramRunStates.Running,
    //                programDisplayState: ProgramDisplayStates.Graph,
    //                remainingTimeInSeconds: this.props.programRunTime || DEFAULT_PROGRAM_TIME});
  };
  private stopProgram = () => {   // FIXME
    // deleteProgram(this.props.programEndTime);
    // const programEndTime = Date.now();
    // this.props.onSetProgramEndTime(programEndTime);
    // const hasDataStorage = this.hasDataStorage();
    // const programDisplayState = hasDataStorage ? ProgramDisplayStates.Graph : ProgramDisplayStates.Program;
    // this.setState({ programRunState: ProgramRunStates.Complete, programDisplayState });
    // this.props.onCheckProgramRunState(programEndTime);
    // this.closeEditorNodePlots();
    // clearInterval(this.intervalHandle);
  };
  private generateProgramData = (programTitle: string) => {
    let interval =  1;
    let datasetName = "";
    const programStartTime = Date.now();
    // Nonsensical change just to avoid an error. This will probably be purged from the code soon.
    // const programEndTime = programStartTime + (1000 * this.props.programRunTime);
    const programEndTime = programStartTime + 1000;

    const hubs: string[] = [];
    const sensors: string[] = [];
    const relays: string[] = [];
    let hasValidData = false;
    let hasValidRelay = false;
    let hasLightbulb = false;
    this.programEditor.nodes.forEach((n: Node) => {
      if (n.name === "Sensor" && n.data.sensor && !n.data.virtual) {
        const chInfo = this.channels.find(ci => ci.channelId === n.data.sensor);
        if (chInfo) {
          // only add hubs once
          if (hubs.indexOf(chInfo.hubId) === -1) {
            hubs.push(chInfo.hubId);
          }
          if (sensors.indexOf(chInfo.channelId) === -1) {
            // only add sensors once
            sensors.push(chInfo.channelId);
          }
        }
      } else if (n.name === "Relay" && n.data.relayList) {
        const chInfo = this.channels.find(ci => ci.channelId === n.data.relayList);
        if (chInfo) {
          if (hubs.indexOf(chInfo.hubId) === -1) {
            hubs.push(chInfo.hubId);
          }
          if (relays.indexOf(chInfo.channelId) === -1) {
            // only add relays once
            relays.push(chInfo.channelId);
            if (this.isValidRelay(chInfo.channelId)) {
              hasValidRelay = true;
              datasetName = programTitle;
            }
          }
        }
      } else if (n.name === "Data Storage") {
        interval = n.data.interval as number;
        hasValidData = true;
        datasetName = programTitle;
      } else if (n.name === "Light Bulb") {
        hasLightbulb = true;
        datasetName = programTitle;
      }
    });

    const rawProgram = this.programEditor.toJSON();
    // strip out recentValues for each node - not needed on the server
    const editedProgram = {
      id: rawProgram.id,
      nodes: {...rawProgram.nodes}
    };
    if (rawProgram.nodes) {
      for (const node of Object.values(rawProgram.nodes)) {
        const newNode = {...node};
        const nodeData = {...node.data};
        if (nodeData.recentValues) delete nodeData.recentValues;
        newNode.data = nodeData;
        // FIXME: This seems to work, though Rete defines NodeData.position as non-optional
        if (newNode.position) delete (newNode as any).position;
        editedProgram.nodes[newNode.id] = newNode;
      }
    }

    const programRunId = this.generateProgramRunId(programTitle, programStartTime);
    const programData = {
      program: {
        endTime: programEndTime,
        hubs,
        program: editedProgram,
        programId: programRunId,  // TODO: remove after lambda function changed to use "programRunId"
        programRunId,
        runInterval: interval * 1000,
        sensors,
        relays
      }
    };

    this.props.onStartProgram({
                title: datasetName,
                runId: programRunId,
                startTime: programStartTime,
                endTime: programEndTime,
                hasData: hasValidData,
                hasRelay: hasValidRelay || hasLightbulb
              });

    return programData;
  };

  private generateProgramRunId(programTitle: string, programStartTime: number) {
    return `${programTitle}-${programStartTime}`;
  }

  private addNode = async (nodeType: string) => {
    const nodeFactory = this.programEditor.components.get(nodeType) as any;
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
    const nodePos = [kLeftMargin * (1 / k) + Math.floor((numNodes % (kNodesPerColumn * kNodesPerRow)) / kNodesPerColumn)
                     * kColumnWidth + Math.floor(numNodes / (kNodesPerColumn * kNodesPerRow)) * kColumnOffset,
                     kTopMargin + numNodes % kNodesPerColumn * kRowHeight];
    return nodePos;
  };

  private moveNodeToFront = (node: any, newNode: boolean) => {
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

  private clearProgram = () => {
    this.programEditor.clear();
    this.setState({disableDataStorage: false});
  };

  // OBSOLETE: this function no longer works as expected
  // Setting ticks=0 no longer resets generators
  // Generators now determine current value using Date.Now()
  private resetNodes = () => {
    this.programEditor.nodes.forEach((n: Node) => {
      if (n.data.recentValues) {
        let values: any = n.data.recentValues;
        values = [];
        n.data.recentValues = values;
        if (n.data.ticks) {
          n.data.ticks = 0;
        }
      }
    });
  };

  private getDatasetName() {
    let datasetName: string | undefined;
    this.programEditor.nodes.forEach((n: Node) => {
      if (n.name === "Data Storage") {
        datasetName = n.data.datasetName as string | undefined;
      }
    });
    return datasetName;
  }

  private hasDataStorage() {
    return this.getNodeCount("Data Storage") > 0;
  }

  private hasRelay() {
    return this.getNodeCount("Relay") > 0;
  }

  private hasLightbulb() {
    return this.getNodeCount("Light Bulb") > 0;
  }

  private isValidRelay(id: string) {
    // placeholder for more complete validation
    return true;
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
            Relay: this.updateNodeChannelInfo
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
    if (this.isRunning() && this.props.programRunId) {
      this.updateGraphDataSet();
    }
    if (processNeeded) {
        // if we've updated values on 1 or more nodes (such as a generator),
        // we need to abort any current processing and reprocess all
        // nodes so current values are up to date
      (async () => {
        await this.programEngine.abort();
        await this.programEngine.process(this.programEditor.toJSON());
      })();
    }
    this.updateRunState();
  };

  private updateNodeChannelInfo = (n: Node) => {
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
    if (sensorSelect && !this.isComplete()) {
      const chInfo = this.channels.find(ci => ci.channelId === n.data.sensor);

      // update virtual sensors
      if (chInfo?.virtualValueMethod) {
        const time = Math.floor(Date.now() / 1000);
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
    const nodeValue: any = n.data.nodeValue;
    let recentValue: NodeValue = {};
    const nodeValueKey = "nodeValue";
    // Store recentValue as object with unique keys for each value stored in node
    // Needed for node types such as data storage that require more than a single value
    if (nodeValue === "number") {
      recentValue[nodeValueKey] = { name: n.name, val: nodeValue };
    } else {
      recentValue = nodeValue;
    }
    if (n.data.recentValues) {
      const recentValues: any = n.data.recentValues;
      if (recentValues.length > MAX_NODE_VALUES) {
        recentValues.shift();
      }
      recentValues.push(recentValue);
      n.data.recentValues = recentValues;
    } else {
      const recentValues: NodeValue[] = [recentValue];
      n.data.recentValues = recentValues;
    }
    const plotControl = n.controls.get("plot") as PlotButtonControl;
    if (plotControl) {
      (n as any).update();
    }
  };

  private getNodeSequenceNamesAndUnits = () => {
    // returns a mapping of input block ids to user-specified sequence names and units if available
    const sequenceNames: NodeSequenceNameMap = {};
    const sequenceUnits: NodeSequenceUnitsMap = {};
    const dataStorage = this.programEditor.nodes.find(n => n.name === "Data Storage");
    if (dataStorage && dataStorage.inputs) {
      Array.from(dataStorage.inputs.values()).forEach((inp: Input) => {
        const nodeId = inp.connections && inp.connections[0] && inp.connections[0].output &&
                       inp.connections[0].output.node && inp.connections[0].output.node.id;
        const sequenceName: unknown = dataStorage.data[inp.key.replace("num", "sequence")];
        if (nodeId && typeof sequenceName === "string") {
          sequenceNames[nodeId] = sequenceName;
          const node = this.programEditor.nodes.find(n => n.id === nodeId && n.name === "Sensor");
          let units = "";
          if (node) {
            const sensorType = NodeSensorTypes.find((s: any) => s.type === node.data.type);
            if (sensorType && sensorType.units) {
              units = sensorType.units;
            }
          }
          sequenceUnits[nodeId] = units;
        }
      });
    }
    return { names: sequenceNames, units: sequenceUnits };
  };

  private updateGraphDataSet = () => {
    if (this.props.programRunId && this.hasDataStorage()) {
      // fetchProgramData(this.props.programRunId).then((result: any) => {  FIXME
      //   // make a new dataset
      //   const graphDataSet: DataSet = {
      //     sequences: [],
      //     startTime: this.props.programStartTime,
      //     endTime: this.props.programEndTime
      //   };
      //   if (result.data) {
      //     result.data.forEach((timeData: any) => {
      //       timeData.values.forEach((value: any, i: number) => {
      //         if (graphDataSet.sequences.length < (i + 1)) {
      //           const name = this.sequenceNames[timeData.blockIds[i]];
      //           const units = this.sequenceUnits[timeData.blockIds[i]];
      //         const graphSequence: DataSequence = {name: name || timeData.blockIds[i], units: units || "", data: []};
      //           graphDataSet.sequences.push(graphSequence);
      //         }
      //         const pt: DataPoint = { x: 0, y: 0 };
      //         pt.x = timeData.time;
      //         pt.y = value;
      //         graphDataSet.sequences[i].data.push(pt);
      //       });
      //     });
      //     this._isMounted && this.setState({ graphDataSet });
      //   } else {
      //     (this.getRunState() === ProgramRunStates.Complete && this._isMounted) && this.setState({ graphDataSet });
      //   }
      // });
    }
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

  private updateRunState = () => {
    if (this.isRunning()) {
      if (this.props.programEndTime && (Date.now() >= this.props.programEndTime)) {
        const hasDataStorage = this.hasDataStorage();
        const programDisplayState = hasDataStorage ? ProgramDisplayStates.Graph : ProgramDisplayStates.Program;
        this.props.onCheckProgramRunState(this.props.programEndTime);
        this.setState({ programRunState: ProgramRunStates.Complete, programDisplayState });
        this.closeEditorNodePlots();
        clearInterval(this.intervalHandle);
        !this.props.readOnly && this.stores.ui.alert("Your run is complete.", "Run Complete");
      } else if (this.props.programEndTime && (Date.now() < this.props.programEndTime)) {
        const remainingTimeInSeconds = Math.ceil((this.props.programEndTime - Date.now()) / 1000);
        this.setState({ remainingTimeInSeconds });
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
