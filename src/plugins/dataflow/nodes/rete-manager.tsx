import React from "react";
import { structures } from "rete-structures";
import { ConnectionPlugin, Presets as ConnectionPresets } from "rete-connection-plugin";
import { Presets, ReactPlugin } from "rete-react-plugin";
import { AreaExtensions, AreaPlugin } from "rete-area-plugin";
import { onPatch, onSnapshot } from "mobx-state-tree";

import { IStores } from "../../../models/stores/stores";
import { DataflowContentModelType } from "../model/dataflow-content";
import {
  DataflowProgramModelType, DataflowProgramSnapshotOut, IConnectionModel
} from "../model/dataflow-program-model";
import { AreaExtra, Schemes } from "./rete-scheme";
import { NodeEditorMST } from "./node-editor-mst";
import { INodeServices } from "./service-types";
import { LogEventName } from "../../../lib/logger-types";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { IBaseNode, IBaseNodeModel, NodeClass } from "./base-node";
import { NodeTypes, ProgramDataRates } from "../model/utilities/node";
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
import { DataflowEngine } from "./engine/dataflow-engine";
import { ValueWithUnitsControl, ValueWithUnitsControlComponent } from "./controls/value-with-units-control";
import { DataflowProgramChange } from "../dataflow-logger";
import { runInAction } from "mobx";
import { getSharedNodes } from "./utilities/shared-program-data-utilities";
import { simulatedChannel } from "../model/utilities/simulated-channel";
import { virtualSensorChannels } from "../model/utilities/virtual-channel";
import { serialSensorChannels } from "../model/utilities/channel";

const MAX_ZOOM = 2;
const MIN_ZOOM = .1;

 /**
* Get an indexed name based on exiting names.
* If existing names are "MyBase 1" and "MyBase 3" this will return "MyBase 5"
* @param existingNames
* @param baseName
* @returns {string} indexed name
*/
export function getNewIndexedName(existingNames: Array<string | undefined>, baseName: string) {
  const matchTypeAndNum = new RegExp(`^${baseName} *(\\d+(\\.\\d+)?)$`);
 const namedNums: number[] = existingNames.map(name => {
   const match = name?.match(matchTypeAndNum);
   return match ? parseInt(match[1], 10) : 0;
 })
 .map(n => isNaN(n) ? 0 : Math.round(n));

 const nextNum = namedNums.length > 0 ? Math.max(...namedNums) + 1 : 1;
 return `${baseName} ${nextNum}`;
}

export class ReteManager implements INodeServices {
  public editor: NodeEditorMST;
  public engine = new DataflowEngine<Schemes>();
  public area: AreaPlugin<Schemes, AreaExtra>;
  private snapshotDisposer: () => void | undefined;
  public inTick = false;
  public disposed = false;
  private previousChannelIds = "";

  constructor(
    private mstProgram: DataflowProgramModelType,
    private tileId: string,
    div: HTMLElement,
    public mstContent: DataflowContentModelType,
    public stores: IStores,
    public readOnly: boolean | undefined,
    public playback: boolean | undefined
  ){
    this.editor = new NodeEditorMST(mstProgram, this.createReteNodeFromNodeModel);
    this.area = new AreaPlugin<Schemes, AreaExtra>(div);
    this.updateMainProcessor();

    this.setup();
  }

  async setup() {
    const { editor, area, mstProgram } = this;

    editor.use(this.engine);

    // Disable the zoom handler which zooms on wheel and double click
    area.area.setZoomHandler(null);

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

    const connectionPlugin = new ConnectionPlugin<Schemes, AreaExtra>();
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
        },
        connection(data) {
          return () => {
            const { path } = Presets.classic.useConnection();
            if (!path) return null;
            return <div className="dataflow-connection"><Presets.classic.Connection data={data.payload} /></div>;
          };
        }
      }
    }));

    connectionPlugin.addPreset(ConnectionPresets.classic.setup());

    editor.use(area);
    // Because these connection and render plugins are added before the notifyAboutExistingObjects,
    // there is a flash as the nodes move into place. The plugins can't be added afterwards because
    // they don't look at the existing nodes when they are added. We might have to modify Rete to
    // remove this flash
    area.use(connectionPlugin);
    area.use(render);

    AreaExtensions.simpleNodesOrder(area);

    const { programZoom } = this.mstContent;
    await this.area.area.zoom(programZoom.scale);
    await this.area.area.translate(programZoom.dx, programZoom.dy);

    // Notify after the area, connection, and render plugins have been configured
    await this.notifyAboutExistingObjects();

    // Need to do an initial process after all of the nodes are create so their inputs are correct
    this.processAfterProgramChange();
    this.updateSharedProgramData();

    if (!this.readOnly) {
      editor.addPipe(context => {
        if (["connectioncreated", "connectionremoved"].includes(context.type)){
          const connection = (context as any).data as IConnectionModel;
          const { source, target } = connection;
          const sourceNode = editor.getNode(source);
          const targetNode = editor.getNode(target);
          const change: DataflowProgramChange = {
            targetType: 'connection',
            nodeTypes: [sourceNode?.label, targetNode?.label],
            nodeIds: [source, target],
            connectionOutputNodeId: source,
            connectionOutputNodeType: sourceNode?.label,
            connectionInputNodeId: target,
            connectionInputNodeType: targetNode?.label
          };
          this.logTileChangeEvent({operation: context.type, change});
        }

        if (["nodecreated", "noderemoved"].includes(context.type)){
          const node = (context as any).data as IBaseNode;
          const change: DataflowProgramChange = {
            targetType: 'node',
            nodeTypes: [node.label],
            nodeIds: [node.id]
          };
          this.logTileChangeEvent({operation: context.type, change});
        }

        return context;
      });

      // Reprocess when connections are changed
      // And also count the serial nodes some of which only get counted if they are
      // connected
      editor.addPipe((context) => {
        if (["noderemoved", "connectioncreated", "connectionremoved"].includes(context.type)) {
          // FIXME: Any changes to the state caused by these events should be combined
          // into the history entry with the actual node removal, connection creation or removal
          // In the meantime we wrap this in an action so it only creates one more history entry
          this.processAfterProgramChange();
          this.countSerialDataNodes();
        }
        return context;
      });
    }

    this.setupOnSnapshot();
  }

  private processAfterProgramChange() {
    this.mstProgram.processAfterProgramChange(this.process);
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

  public get currentTick() {
    return this.mstProgram.currentTick;
  }

  public get recentTicks() {
    return this.mstProgram.recentTicks;
  }

  public get recordedTicks() {
    return this.mstProgram.recordedTicks;
  }
  private updateMainProcessor() {
    const { mstProgram, readOnly, disposed } = this;
    if (disposed) {
      console.warn("Trying to process after being disposed");
      return;
    }
    const { processor } = mstProgram;
    if (processor === this) {
      // We already are the processor
      return;
    }

    if (
        // There is no processor, so we are best option
        !processor ||

        // The processor is disposed, so we are better
        processor.disposed ||

        // We are not readonly but the processor is, so we are better
        !readOnly && processor.readOnly
    ) {
      mstProgram.setProcessor(this);
    }
  }

  public process = () => {
    this.updateMainProcessor();

    // Only do the process if we are main processor for this MST Program
    if (this.mstProgram.processor !== this) return;

    let readOnPatchDisposer;
    if (this.readOnly) {
      readOnPatchDisposer = onPatch(this.mstContent, (patch) => {
        // It is likely that Dataflow will kind of crash when this happens
        // So you'll need to fix the problem, and possibly disable readOnly processing
        // to get the original diagram to load if you need to modify it before fixing
        // this.
        console.warn("readOnly process modified the tile", patch);
      });
    }

    const { editor } = this;

    this.engine.reset();

    // It seems like structures should correctly handle our setup, but from what
    // I can tell it is reading the empty private nodes and connections from
    // from our parent. So we make this explicit
    const graph = structures({nodes: editor.getNodes(), connections: editor.getConnections()});

    // Because rete engine caches values even if the same node is the
    // parent of two leaves the data function of that common parent
    // will only be called once.
    const leafNodes = graph.leaves().nodes();
    leafNodes.forEach(n => this.engine.fetch(n.id));

    readOnPatchDisposer?.();
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

    // Temporary use this approach to get things working
    const removedPromises = removedConnections.map(connection =>
      editor.emit({ type: 'connectionremoved', data: connection })
    );
    await Promise.all(removedPromises);

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

  /**
   * Given @param nodeType (string)
   * Discovers the display name for that node type
   * Searches for existing nodes with names like {nodeType} {n}
   * If it does not find such nodes, it returns {nodeType} 1
   * Otherwise it uses getNewIndexedName to find the next available index
   * @returns `{nodeType} {n+1}`
   */
  private getNewNodeName(nodeType: string) {
    const printableType = NodeTypes.find((nt) => nt.name === nodeType)?.displayName ?? nodeType;

    const nodesNamedAsType = this.editor.getNodes()
      .map(n=> (n as IBaseNode).model.orderedDisplayName)
      .filter(name => name?.includes(printableType));

    if (!nodesNamedAsType) return printableType + " 1";
    return getNewIndexedName(nodesNamedAsType, printableType);
  }

  public async createAndAddNode(nodeType: string, position?: [number, number]) {
    const id = uniqueId();
    const { editor } = this;
    const newPosition = position ?? this.getNewNodePosition();
    // FIXME: because this is not a single synchronous MST transaction
    // the nodeValue of the added node is updated by the process call
    // down below. This means that any readOnly views will try to initialize
    // the nodeValue. That isn't a problem it is just confusing. The bigger
    // problem is that this results in two history events so undo is broken.
    this.mstProgram.addNodeSnapshot({
      id,
      name: nodeType,
      x: newPosition[0],
      y: newPosition[1],
      data: {
        type: nodeType,
        orderedDisplayName: this.getNewNodeName(nodeType),
      }
    });

    const node = editor.getNode(id);

    // Temporarily emit like normal. Ideally the onPatch above would be used
    // to emit instead, so this is consistent regardless of how the state
    // is changed.
    // This is not waiting for the emit before calling the process.
    // we might need to add it
    await editor.emit({ type: 'nodecreated', data: node });

    this.processAfterProgramChange();

    this.area.translate(id, {x: newPosition[0], y: newPosition[1]});
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

  private get simulatedChannels() {
    return this.mstContent
      ? this.mstContent.inputVariables?.map(variable => simulatedChannel(variable)) ?? []
      : [];
  }

  public updateChannels() {
    const channels = [...virtualSensorChannels, ...this.simulatedChannels, ...serialSensorChannels];

    // The only channels that might be added or removed from this array change are the simulatedChannels
    const channelIds = channels.map(c => c.channelId).join(",");
    if (channelIds !== this.previousChannelIds) {
      this.previousChannelIds = channelIds;
      this.mstContent.setChannels(channels);

      this.countSerialDataNodes();
    }

    // NOTE: these channels are observable, so changes to their missing or connected
    // status should trigger updates.
    this.mstContent.channels.filter(c => c.usesSerial).forEach((channel) => {
      const { serialDevice } = this.stores;
      if (serialDevice.hasPort()){
        channel.serialConnected = true;
        const deviceMismatch = serialDevice.deviceFamily !== channel.deviceFamily;
        const timeSinceActive = channel.usesSerial && channel.lastMessageReceivedAt
          ? Date.now() - channel.lastMessageReceivedAt: 0;
        channel.missing = deviceMismatch || timeSinceActive > 7000;
      } else {
        channel.serialConnected = false;
        channel.missing = true;
      }
    });
  }

  public tickAndProcessNodes() {
    // This is wrapped in an MST action so all of the changes are batched together
    // We are using our own custom Rete Dataflow Engine which runs synchronously
    // so all calls to the nodes `data` and `onTick` methods are grouped together.
    this.mstProgram.tickAndProcess(() => {
      this.updateChannels();
      this.inTick = true;
      this.process();
      this.inTick = false;
    });
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

    // We aren't using editor.getNodes() because the editor might have been deleted
    // So all we really want to do is clean up any of the rete nodes that might have
    // timers running
    Object.values(editor.reteNodesMap).forEach(node => (node as IBaseNode).dispose());

    this.disposed = true;
  }

  public setupOnSnapshot() {
    // TODO: handle undo/redo events too
    if (!this.readOnly) return;

    this.snapshotDisposer = onSnapshot(this.mstProgram, this.updateProgramEditor);
  }

  private updateProgramEditor = async (snapshot: DataflowProgramSnapshotOut) => {
    // When sending removed events we have to hack the types because we don't want to
    // track down an instance of the node or connection that was deleted. The area
    // plugin only cares about the id.

    const { editor, area } = this;

    // Process connections that were deleted
    for (const [id] of area.connectionViews) {
      if (!snapshot.connections[id]) {
        // FIXME-p1: this causes problems because the rete-area-plugin keeps a
        // reference to the connection object in its connectionViews. And then
        // it tries to access the id of this connection object. But MST complains
        // because the connection object has already been removed from the tree
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

    // Let the nodes update their volatile state so their components can show
    // the input values without us storing them in state.
    // We run this in an action because even in readOnly mode some node data
    // functions update MobX or MobX State tree properties.
    // We don't use processAfterProgramChange because it shouldn't be modifying
    // and MST state, so MST should complain if a node's data method messes with
    // the node model directly. If the data method uses an action this won't be
    // reported. We also don't care about recording this in history because this
    // is a readOnly doc.
    runInAction(() => {
      this.process();
      this.updateSharedProgramData();
    });
  };

  public updateSharedProgramData = () => {
    const nodes = this.editor.getNodes() as IBaseNode[];
    const sharedProgramModel = this.mstContent.sharedProgramData;
    if (!sharedProgramModel) return;
    const sharedNodes = getSharedNodes(nodes);
    sharedProgramModel.setProgramNodes(sharedNodes);
    const rateStr = ProgramDataRates.find((item) => item.val === Number(this.mstContent.programDataRate))?.text ?? "";
    const rateNum = ProgramDataRates.find((item) => item.val === Number(this.mstContent.programDataRate))?.val ?? 0;
    sharedProgramModel.setProgramSamplingRateStr(rateStr);
    sharedProgramModel.setProgramSamplingRate(rateNum);
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
