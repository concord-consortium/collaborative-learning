import React from "react";
import { DataflowEngine } from "rete-engine";
import { structures } from "rete-structures";
import { ConnectionPlugin, Presets as ConnectionPresets } from "rete-connection-plugin";
import { Presets, ReactPlugin } from "rete-react-plugin";
import { AreaExtensions, AreaPlugin } from "rete-area-plugin";
import { onSnapshot } from "mobx-state-tree";

import { IStores } from "../../../models/stores/stores";
import { DataflowContentModelType } from "../model/dataflow-content";
import { DataflowProgramModelType, DataflowProgramSnapshotOut } from "../model/dataflow-program-model";
import { AreaExtra, Schemes } from "./rete-scheme";
import { NodeEditorMST } from "./node-editor-mst";
import { INodeServices } from "./service-types";
import { LogEventName } from "../../../lib/logger-types";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { IBaseNode, IBaseNodeModel, NodeClass } from "./base-node";
import { ControlNode } from "./control-node";
import { CounterNode } from "./counter-node";
import { DemoOutputNode } from "./demo-output-node";
import { GeneratorNode } from "./generator-node";
import { LiveOutputNode } from "./live-output-node";
import { LogicNode } from "./logic-node";
import { MathNode } from "./math-node";
import { NumberNode } from "./number-node";
import { SensorNode } from "./sensor-node";
import { TimerNode } from "./timer-node";
import { TransformNode } from "./transform-node";
import { uniqueId } from "../../../utilities/js-utils";
import { CustomDataflowNode } from "./dataflow-node";
import { ValueControl, ValueControlComponent } from "./controls/value-control";
import { NumberUnitsControl, NumberUnitsControlComponent } from "./controls/num-units-control";
import { NumberControl, NumberControlComponent } from "./controls/num-control";
import { DropdownListControl, DropdownListControlComponent } from "./controls/dropdown-list-control";
import { DemoOutputControl, DemoOutputControlComponent } from "./controls/demo-output-control";
import { PlotButtonControl, PlotButtonControlComponent } from "./controls/plot-button-control";
import { InputValueControl, InputValueControlComponent } from "./controls/input-value-control";
import { ValueWithUnitsControl, ValueWithUnitsControlComponent } from "./controls/value-with-units-control";

const MAX_ZOOM = 2;
const MIN_ZOOM = .1;

export class ReteManager {
  public editor: NodeEditorMST;
  public engine = new DataflowEngine<Schemes>();
  public area: AreaPlugin<Schemes, AreaExtra>;
  private snapshotDisposer: () => void | undefined;

  constructor(
    private mstProgram: DataflowProgramModelType,
    private tileId: string,
    div: HTMLElement,
    public mstContent: DataflowContentModelType,
    public stores: IStores,
    public runnable: boolean | undefined,
    public readOnly: boolean | undefined,
    public playback: boolean | undefined
  ){
    this.editor = new NodeEditorMST(mstProgram, this.process, this.createReteNodeFromNodeModel);
    this.area = new AreaPlugin<Schemes, AreaExtra>(div);

    this.setup();
  }

  async setup() {
    const { editor, area, mstProgram } = this;

    editor.use(this.engine);

    // Disable the zoom handler which zooms on wheel and double click
    area.area.setZoomHandler(null);

    // FIXME: we need to set the initial zoom from the mstContent

    AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
      accumulating: AreaExtensions.accumulateOnCtrl()
    });

    area.addPipe((context) => {
      if (context.type !== "nodedragged") return context;

      const id = context.data.id;
      const nodeView = area.nodeViews.get(id);

      // This should not happen, but it is possible in theory
      if (!nodeView) return context;

      const nodeModel = mstProgram.nodes.get(id);

      // This should also not happen but seems more likely
      if (!nodeModel) {
        console.warn("Cannot find MST node model for a dragged Rete node");
        return context;
      }

      nodeModel.setPosition(nodeView.position);
      return context;
    });

    // Useful for debugging:
    // this.area.addPipe((context) => {
    //   if (["pointermove", "render", "rendered"].includes(context.type)) return context;

    //   console.warn("area event", context, this.area.area.transform);
    //   return context;
    // });

    // editor.addPipe((context) => {
    //   console.log("editor event", context);
    //   return context;
    // });

    const connection = new ConnectionPlugin<Schemes, AreaExtra>();
    const render = new ReactPlugin<Schemes, AreaExtra>();

    // render.addPipe((context) => {
    //   if (!["pointermove", "nodetranslate", "nodetranslated"].includes(context?.type as any)) {
    //     console.log("render event", context);
    //   }
    //   return context;
    // });

    render.addPreset({
      render: (context: any, plugin: ReactPlugin<Schemes, unknown>):
          React.ReactElement<any, string | React.JSXElementConstructor<any>> | null | undefined => {
        if (context.data.type === 'node') {
          // We could go further than this and completely replace the whole control system

          return (
            <CustomDataflowNode
              data={context.data.payload}
              emit={data => area.emit(data as any)}
              area={area}
              editor={editor}
              reteManager={this}
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
        node(data) {
          console.warn("unexpected node customizer called");
          return null;
        },
        control(data) {
          if (data.payload instanceof ValueControl) {
            return ValueControlComponent;
          }
          if (data.payload instanceof ValueWithUnitsControl) {
            return ValueWithUnitsControlComponent;
          }
          if (data.payload instanceof NumberUnitsControl) {
            return NumberUnitsControlComponent;
          }
          if (data.payload instanceof NumberControl) {
            return NumberControlComponent;
          }
          if (data.payload instanceof DropdownListControl) {
            return DropdownListControlComponent;
          }
          if (data.payload instanceof DemoOutputControl) {
            return DemoOutputControlComponent;
          }
          if (data.payload instanceof PlotButtonControl) {
            return PlotButtonControlComponent;
          }
          if (data.payload instanceof InputValueControl) {
            return InputValueControlComponent;
          }
          return null;
        }
      }
    }));

    connection.addPreset(ConnectionPresets.classic.setup());

    editor.use(area);
    // Because these connection and render plugins are added before the notifyAboutExistingObjects,
    // there is a flash as the nodes move into place. The plugins can't be added afterwards because
    // they don't look at the existing nodes when they are added. We might have to modify Rete to
    // remove this flash
    area.use(connection);
    area.use(render);

    AreaExtensions.simpleNodesOrder(area);

    // Notify after the area, connection, and render plugins have been configured
    await this.notifyAboutExistingObjects();


    // Reprocess when connections are changed
    // And also count the serial nodes some of which only get counted if they are
    // connected
    editor.addPipe((context) => {
      if (["noderemoved", "connectioncreated", "connectionremoved"].includes(context.type)) {
        this.process();
        this.countSerialDataNodes();
      }
      return context;
    });

    // TODO: maybe this isn't needed anymore
    setTimeout(() => {
      // The zoomAt call was centering the origin of the dataflow canvas.
      // This messes up the default node placement, and would likely mess up saved state.
      // By removing this, we aren't going to be automatically making sure all of the nodes are visible
      // AreaExtensions.zoomAt(area, editor.getNodes());

      // In our Rete v1 implementation the origin always started at the top left of the component.
      // When a user translated the canvas this translation was saved in the file, but
      // it seems like it is just ignored when the program is loaded back in again.

      // This is needed to initialize things like the value control's sentence
      // It was having problems when called earlier
      this.process();
    }, 10);

    this.setupOnSnapshot();
  }

  public async notifyAboutExistingObjects() {
    const { editor } = this;
    for (const node of editor.getNodes()) {
      // We need to wait for this before we add connections and translate the nodes
      await editor.emit({ type: 'nodecreated', data: node });
    }
    for (const connection of editor.getConnections()) {
      await editor.emit({ type: 'connectioncreated', data: connection});
    }

    // FIXME: this causes a flash when the nodes move into position. I think the
    // right fix is to delay the creation of the render plugin until all of the
    // nodes have been positioned. But I'm not sure if the render plugin is
    // smart enough to look at existing nodes or it just watches events.
    for (const [id, nodeModel] of this.mstProgram.nodes) {
      await this.area.translate(id, { x: nodeModel.x, y: nodeModel.y });
    }
  }

  public process = () => {
    console.log("NodeEditorMST.process");

    // Don't do any processing when we are read-only
    if (this.readOnly) return;

    const { editor } = this;

    this.engine.reset();

    // It seems like structures should correctly handle our setup, but from what
    // I can tell it is reading the empty private nodes and connections from
    // from our parent. So we make this explicit
    const graph = structures({nodes: editor.getNodes(), connections: editor.getConnections()});

    // Because rete engine caches values even if the same node is the
    // parent of two leaves the data function of that common parent
    // will only be called once.
    // debugger;
    const leafNodes = graph.leaves().nodes();
    leafNodes.forEach(n => this.engine.fetch(n.id));
  };

  public logTileChangeEvent = (
    {operation, change}: Parameters<INodeServices['logTileChangeEvent']>[0]
  ) => {
    const logEventName = LogEventName.DATAFLOW_TOOL_CHANGE;
    logTileChangeEvent(logEventName, { operation, change, tileId: this.tileId });
  };

  public selectNode = (nodeId: string) => {
    this.area.emit({ type: "nodepicked", data: { id: nodeId } });
  };

  public update = (type: "node" | "connection" | "socket" | "control", id: string) => {
    this.area.update(type, id);
  };

  public isConnected = (nodeId: string, inputKey: string) => {
    const matchingConnection = [...this.mstProgram.connections.values()].find(connection =>
      connection.target === nodeId && connection.targetInput === inputKey);

    return !!matchingConnection;
  };

  public getOutputVariables = () => {
    return this.mstContent.outputVariables ?? [];
  };

  public removeInputConnection = (nodeId: string, inputKey: string) => {
    const matchingConnection = [...this.mstProgram.connections.values()].find(connection =>
      connection.target === nodeId && connection.targetInput === inputKey);

    if (!matchingConnection) return;
    this.editor.removeConnection(matchingConnection.id);
  };

  public getChannels = () => {
    return this.mstContent.channels;
  };

  public async removeNodeAndConnections(nodeId: string) {
    const { editor } = this;

    const node = editor.getNode(nodeId);
    const removedConnections = this.mstProgram.removeNodeAndConnections(nodeId);

    // FIXME: Rete is not happy with this it reports several canceled promises

    removedConnections.forEach(connection => {
      // Temporary use this approach to get things working
      editor.emit({ type: 'connectionremoved', data: connection });
    });

    // Temporary use this approach to get things working
    editor.emit({ type: 'noderemoved', data: node});

    // TODO: might need clear the selection, but it might happen automatically
  }

  private createReteNodeFromNodeModel = (id: string, model: IBaseNodeModel) => {
    const nodeTypes: Record<string, NodeClass> =
    {
      "Control": ControlNode,
      "Counter": CounterNode,
      "Demo Output": DemoOutputNode,
      "Generator": GeneratorNode,
      "Live Output": LiveOutputNode,
      "Logic": LogicNode,
      "Math": MathNode,
      "Number": NumberNode,
      "Sensor": SensorNode,
      "Timer": TimerNode,
      "Transform": TransformNode,
    };

    const constructor = nodeTypes[model.type];
    if (!constructor) {
      console.warn(`Can't find constructor for ${model.type}`);
      return;
    }

    return new constructor(id, model, this);
  };

  public async createAndAddNode(nodeType: string, position?: [number, number]) {
    const id = uniqueId();
    const { editor } = this;
    const newPosition = position ?? this.getNewNodePosition();
    console.log("createAndAddNode", nodeType, newPosition);
    this.mstProgram.addNodeSnapshot({
      id,
      name: nodeType,
      x: newPosition[0],
      y: newPosition[1],
      data: { type: nodeType }
    });

    const node = editor.getNode(id);

    // Temporarily emit like normal. Ideally the onPatch above would be used
    // to emit instead, so this is consistent regardless of how the state
    // is changed.
    // This is not waiting for the emit before calling the process.
    // we might need to add it
    await editor.emit({ type: 'nodecreated', data: node });

    this.area.translate(id, {x: newPosition[0], y: newPosition[1]});

    // run the process command so this newly added node can update any controls like the
    // value control.
    this.process();
  }

  getNewNodePosition() {
    const kNodesPerColumn = 5;
    const kNodesPerRow = 4;
    const kColumnWidth = 200;
    const kRowHeight = 90;
    const kLeftMargin = 40;
    const kTopMargin = 5;
    const kColumnOffset = 15;

    const numNodes = this.editor.getNodes().length;
    const { k } = this.area.area.transform;
    const nodePos: [number, number] =
      [kLeftMargin * (1 / k) + Math.floor((numNodes % (kNodesPerColumn * kNodesPerRow)) / kNodesPerColumn)
        * kColumnWidth + Math.floor(numNodes / (kNodesPerColumn * kNodesPerRow)) * kColumnOffset,
      kTopMargin + numNodes % kNodesPerColumn * kRowHeight];
    return nodePos;
  }

  public countSerialDataNodes(){
    // Hack the type for now
    const nodes = this.editor.getNodes() as IBaseNode[];

    // implementing with a "count" of 1 or 0 in case we need to count nodes in future
    let serialNodesCt = 0;
    nodes.forEach((n) => {
      if ((n instanceof LiveOutputNode || n instanceof SensorNode) && n.requiresSerial()){
        serialNodesCt++;
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

  public tickAndProcessNodes() {
    let processNeeded = false;

    // This has to be hacked until we figure out the way to specify the Rete Schemes
    // so its node type is our node specific node types
    const nodes = this.editor.getNodes() as unknown as IBaseNode[];
    nodes.forEach(node => {
      // If tick returns true then it means something was updated
      // and we need to reprocess the diagram
      if(node.onTick()) {
        processNeeded = true;
      }
      // Perhaps move this to the model since it should just be working on
      // stuff in the model
      node.model.updateRecentValues();
    });
    if (processNeeded) {
        // if we've updated values on 1 or more nodes (such as a generator),
        // reprocess all nodes so current values are up to date
        this.process();
    }
  }

  public dispose() {
    this.snapshotDisposer?.();

    const {area, editor} = this;
    // This should unmount the React components.
    // As far as I can tell Rete doesn't have cleaup or destroy function to unmount
    // all of the nodes and connections that it creates React roots for. The loops
    // below do this.  If a node or connection is removed, then all of its
    // sub parts (controls and sockets) are also unmounted.
    area.nodeViews.forEach((view, id) => {
      area.removeNodeView(id);
    });
    area.connectionViews.forEach((view, id) => {
      area.removeConnectionView(id);
    });

    const nodes = editor.getNodes();
    nodes.forEach(node => (node as IBaseNode).dispose());
  }

  public setupOnSnapshot() {
    // TODO: handle undo/redo events too
    if (!this.readOnly) return;

    this.snapshotDisposer = onSnapshot(this.mstProgram, snapshot => {
        this.updateProgramEditor(snapshot);
    });
  }

  private updateProgramEditor = async (snapshot: DataflowProgramSnapshotOut) => {
    // When sending removed events we have to hack the types because we don't want to
    // track down an instance of the node or connection that was deleted. The area
    // plugin only cares about the id.

    const { editor, area } = this;

    // Process connections that were deleted
    for (const [id] of area.connectionViews) {
      if (!snapshot.connections[id]) {
        await editor.emit({ type: 'connectionremoved', data: { id } as any });
      }
    }

    // Process nodes that were deleted
    for (const [id] of area.nodeViews) {
      if (!snapshot.nodes[id]) {
        (editor.reteNodesMap[id] as IBaseNode)?.dispose();
        await editor.emit({ type: 'noderemoved', data: { id } as any });
      }
    }

    // Process nodes that were added
    for (const id of Object.keys(snapshot.nodes)) {
      if (!area.nodeViews.get(id)) {
        const node = editor.getNode(id);
        await editor.emit({ type: 'nodecreated', data: node });
      }
    }

    // Process connections that were added
    for (const id of Object.keys(snapshot.connections)) {
      if (!area.connectionViews.get(id)) {
        const connection = editor.getConnection(id);
        await editor.emit({ type: 'connectioncreated', data: connection });
      }
    }

    // Process nodes that were moved
    for (const [id, view] of area.nodeViews) {
      const snapshotNode = snapshot.nodes[id];
      const position = view.position;
      if (snapshotNode.x !== position.x || snapshotNode.y !== position.y) {
        area.translate(id, {x: snapshotNode.x, y: snapshotNode.y});
      }
    }
  };

  public zoomIn = () => {
    const { k } = this.area.area.transform;
    this.setZoom(Math.min(MAX_ZOOM, k + .05));
  };

  public zoomOut = () => {
    const { k } = this.area.area.transform;
    this.setZoom(Math.max(MIN_ZOOM, k - .05));
  };

  private async setZoom(zoom: number) {
    await this.area.area.zoom(zoom);
    const { transform } = this.area.area;
    this.mstContent.setProgramZoom(transform.x, transform.y, transform.k);
  }
}
