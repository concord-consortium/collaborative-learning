import React from "react";
import ReactDOM from "react-dom";
import "regenerator-runtime/runtime";
import { inject, observer } from "mobx-react";
import { IDisposer, onSnapshot } from "mobx-state-tree";
import { SizeMeProps } from "react-sizeme";

import { BaseComponent } from "../../../components/base";
import { ProgramZoomType, DataflowContentModelType } from "../model/dataflow-content";
import { DataflowProgramModelType } from "../model/dataflow-program-model";
import { simulatedChannel } from "../model/utilities/simulated-channel";

import { DataflowProgramToolbar } from "./ui/dataflow-program-toolbar";
import { DataflowProgramTopbar } from "./ui/dataflow-program-topbar";
import { DataflowProgramCover } from "./ui/dataflow-program-cover";
import { DataflowProgramZoom } from "./ui/dataflow-program-zoom";
import { NodeChannelInfo, serialSensorChannels } from "../model/utilities/channel";
import { ProgramDataRates } from "../model/utilities/node";
import { virtualSensorChannels } from "../model/utilities/virtual-channel";
import { DocumentContextReact } from "../../../components/document/document-context";
import { ProgramMode, UpdateMode } from "./types/dataflow-tile-types";
import { ITileModel } from "../../../models/tiles/tile-model";
import { IDataSet } from "../../../models/data/data-set";

import "./dataflow-program.sass";
import { ClassicPreset, NodeEditor } from "rete";
import { Presets, ReactPlugin } from "rete-react-plugin";
import { AreaExtensions, AreaPlugin, BaseAreaPlugin } from "rete-area-plugin";
import { ConnectionPlugin, Presets as ConnectionPresets } from "rete-connection-plugin";
import { NumberNode, NumberNodeModel } from "../rete/nodes/number-node";
import { NumberControl, NumberControlComponent } from "../rete/controls/num-control";
import { MathNode, MathNodeModel } from "../rete/nodes/math-node";
import { ValueControl, ValueControlComponent } from "../rete/controls/value-control";
import { DataflowEngine } from "rete-engine";
import { CustomDataflowNode } from "../nodes/dataflow-node";
import {
  DropdownListControl, DropdownListControlComponent
} from "../rete/controls/dropdown-list-control";
import { AreaExtra, Schemes } from "../rete/rete-scheme";
import { NodeEditorMST } from "../rete/node-editor-mst";
import { LogicNode, LogicNodeModel } from "../rete/nodes/logic-node";
import { IBaseNode } from "../rete/nodes/base-node";
import { GeneratorNode, GeneratorNodeModel } from "../rete/nodes/generator-node";


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

const numSocket = new ClassicPreset.Socket("Number value");

const RETE_APP_IDENTIFIER = "dataflow@0.1.0";
const MAX_ZOOM = 2;
const MIN_ZOOM = .1;

@inject("stores")
@observer
export class DataflowProgram extends BaseComponent<IProps, IState> {
  public static contextType = DocumentContextReact;

  private toolDiv: HTMLElement | null;
  private channels: NodeChannelInfo[] = [];
  private previousChannelIds = "";
  private intervalHandle: ReturnType<typeof setTimeout>;
  private lastIntervalTime: number;
  private programEditor: NodeEditorMST;
  private programEngine: DataflowEngine<Schemes>;
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
  };

  private initProgramEngine = () => {
  };

  private initProgramEditor = (clearHistory = false) => {
    (async () => {
      if (!this.toolDiv || !this.props.program) return;

      const editor = new NodeEditorMST(this.props.program);
      this.programEditor = editor;

      editor.addPipe((context) => {
        console.warn("editor event", context);
        return context;
      });

      const area = new AreaPlugin<Schemes, AreaExtra>(this.toolDiv);
      const connection = new ConnectionPlugin<Schemes, AreaExtra>();
      const render = new ReactPlugin<Schemes, AreaExtra>();
      this.programEngine = editor.engine;

      AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
        accumulating: AreaExtensions.accumulateOnCtrl()
      });

      render.addPreset({
        render(context: any, plugin: ReactPlugin<Schemes, unknown>):
            React.ReactElement<any, string | React.JSXElementConstructor<any>> | null | undefined {
          if (context.data.type === 'node') {
            // We could go further than this and completely replace the whole control system

            // We could get these just from up above, but if we want to make this a real
            // preset living in another file, then it is better to get them using the
            // parentScope function
            // We need them so our custom node can just delete itself
            // So far we don't need the area, but it might come in handy, perhaps for resizing
            // the node
            const _area = plugin.parentScope<BaseAreaPlugin<Schemes, any>>(BaseAreaPlugin);
            const _editor = area.parentScope<NodeEditor<Schemes>>(NodeEditor);

            return (
              <CustomDataflowNode
                data={context.data.payload}
                emit={data => _area.emit(data as any)}
                area={_area}
                editor={_editor}
              />
            );
          }
          // When we return null Rete will fall through to the next preset, which is the
          // Classic preset which provides the controls.
          // We might want to replace the current approach of rendering these controls
          // in their own React root elements, and instead just render them directly
          // in CustomDataflowNode.
          return null;
        }
      });

      render.addPreset(Presets.classic.setup({
        customize: {
          control(data) {
            if (data.payload instanceof ValueControl) {
              return ValueControlComponent;
            }
            if (data.payload instanceof NumberControl) {
              return NumberControlComponent;
            }
            if (data.payload instanceof DropdownListControl) {
              return DropdownListControlComponent;
            }
            return null;
          }
        }
      }));

      connection.addPreset(ConnectionPresets.classic.setup());

      editor.use(area);
      area.use(connection);
      area.use(render);

      AreaExtensions.simpleNodesOrder(area);

      // Notify after the area, connection, and render plugins have been configured
      editor.notifyAboutExistingObjects();

      // Reprocess when connections are changed
      editor.addPipe((context) => {
        if (["connectioncreated", "connectionremoved"].includes(context.type)) {
          this.programEditor.process();
        }
        return context;
      });

      // area.nodeViews
      // await area.translate(a.id, { x: 0, y: 0 });
      // await area.translate(b.id, { x: 270, y: 0 });


      setTimeout(() => {
        // wait until nodes rendered because they dont have predefined width and height
        AreaExtensions.zoomAt(area, editor.getNodes());

        // This is needed to initialize things like the value control's sentence
        // It was having problems when called earlier
        this.programEditor.process();
      }, 10);
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
  }

  private destroyEditor() {
    this.reactElements.forEach(el => {
      ReactDOM.unmountComponentAtNode(el);
    });
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
      return;
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
    }

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
  };

  private addNode = async (nodeType: string, position?: [number, number]) => {

    let node;
    switch(nodeType) {
      case "Generator": {
        const genModel = GeneratorNodeModel.create();
        node = new GeneratorNode(undefined, genModel, this.programEditor.process);
        break;
      }
      case "Logic": {
        const logicModel = LogicNodeModel.create();
        node = new LogicNode(undefined, logicModel, this.programEditor.process);
        break;
      }
      case "Math": {
        const mathModel = MathNodeModel.create();
        node = new MathNode(undefined, mathModel, this.programEditor.process);
        break;
      }
      case "Number": {
        const numModel = NumberNodeModel.create();
        node = new NumberNode(undefined, numModel, this.programEditor.process);
        break;
      }
      default:
        break;
    }
    if (!node) return;

    this.programEditor.addNode(node);
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
  };

  private playbackNodesWithCaseData = (dataSet: IDataSet, playBackIndex: number) => {
    const caseId = dataSet.getCaseAtIndex(playBackIndex)?.__id__;
    if (!caseId) return;
    // Keep TS happy
    return "foo";
  };

  private updateNodes = () => {
    let processNeeded = false;

    // This has to be hacked until we figure out the way to specify the Rete Schemes
    // so its node type is our node specific node types
    const nodes = this.programEditor.getNodes() as unknown as IBaseNode[];
    nodes.forEach(node => {
      // If tick returns true then it means something was updated
      // and we need to reprocess the diagram
      if(node.tick()) {
        processNeeded = true;
      }
      // Perhaps move this to the model since it should just be working on
      // stuff in the model
      node.model.updateRecentValues();
    });
    if (processNeeded) {
        // if we've updated values on 1 or more nodes (such as a generator),
        // reprocess all nodes so current values are up to date
        this.programEditor.process();
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
    // eslint-disable-next-line prefer-const
    let serialNodesCt = 0;

    nodes.forEach((n) => {
      const isLiveSensor = /fsr|emg|tmp|[th]-[abcd]/; // match ids any live sensor channels
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
  };

  private zoomOut = () => {
  };

  private setZoom = (zoom: number) => {
  };
}
