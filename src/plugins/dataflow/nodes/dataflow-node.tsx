import * as React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { ClassicScheme, RenderEmit, Presets } from "rete-react-plugin";
import { BaseAreaPlugin } from "rete-area-plugin";

import { DataflowNodePlot } from "./dataflow-node-plot";
import { IBaseNode } from "./base-node";
import { NodeEditorMST } from "./node-editor-mst";
import { Delete } from "./delete";
import { ControlNode } from "./control-node";
import { ReteManager } from "./rete-manager";
import { getNodeLetter } from "./utilities/view-utilities";
import { EditableNodeName } from "./editable-node-name";

const { RefSocket, RefControl } = Presets.classic;

import "./dataflow-node.scss";
import "./node-states.scss";


type NodeExtraData = { width?: number, height?: number }

//export const DataflowNodeStyles = styled.div<NodeExtraData & { selected: boolean, styles?: (props: any) => any }>``;

function sortByIndex<T extends [string, undefined | { index?: number }][]>(entries: T) {
  entries.sort((a, b) => {
    const ai = a[1]?.index || 0;
    const bi = b[1]?.index || 0;

    return ai - bi;
  });
}

function inputClass(s?: string) {
  return s ? "input " + s.toLowerCase().replace(/ /g, "-") : "input";
}

type Props<S extends ClassicScheme> = {
    data: S['Node'] & NodeExtraData
    styles?: () => any
    emit: RenderEmit<S>
    area: BaseAreaPlugin<S, any>
    editor: NodeEditorMST,
    reteManager: ReteManager
}
export type DataflowNodeComponent<Scheme extends ClassicScheme> = (props: Props<Scheme>) => JSX.Element

export const CustomDataflowNode = observer(
  function CustomDataflowNode<Scheme extends ClassicScheme>({data, styles, emit, editor, reteManager}: Props<Scheme>)
{
  const inputs = Object.entries(data.inputs);
  const outputs = Object.entries(data.outputs);
  const controls = Object.entries(data.controls);
  const { id } = data;

  // FIXME: update 'Scheme' so we don't have to typecast here
  const node = (data as unknown as IBaseNode);
  const model = node.model;

  const nodeLetter = getNodeLetter(model.type);

  const showPlot = model.plot;

  sortByIndex(inputs);
  sortByIndex(outputs);
  sortByIndex(controls);

  const dynamicClasses = classNames({
    "gate-active": node instanceof ControlNode && node.model.gateActive,
    "has-flow-in": node instanceof ControlNode && node.hasFlowIn(),
    "plot-open": showPlot,
  });

  return (
    <div
      className={`node ${model.type.toLowerCase().replace(/ /g, "-")} ${dynamicClasses}`}
      data-testid="node"
    >
      <div className="top-bar" onClick={() => console.log("top-bar click")}>
        <Delete reteManager={reteManager} nodeId={id}/>
      </div>

      <div className="node-type-letter">{nodeLetter}</div>

      <EditableNodeName node={node} />

      {/* Outputs */}
      {outputs.map(([key, output]) => (
        output &&
          <div className="output" key={key} data-testid={`output-${key}`}>
            <div className="output-title" data-testid="output-title">{output?.label}</div>
            <RefSocket
              name="output-socket"
              side="output"
              socketKey={key}
              nodeId={id}
              emit={emit}
              payload={output.socket}
              data-testid="output-socket"
            />
          </div>
      ))}
      {/* Controls */}
      {controls.map(([key, control]) => {
        return control ? <RefControl
          key={key}
          name="control"
          emit={emit}
          payload={control}
          data-testid={`control-${key}`}
        /> : null;
      })}
      {/* Inputs */}
      {inputs.map(([key, input]) => (
        input &&
          <div className={inputClass(input.label)} key={key} data-testid={`input-${key}`}>
            <RefSocket
              name="input-socket"
              side="input"
              socketKey={key}
              nodeId={id}
              emit={emit}
              payload={input.socket}
              data-testid="input-socket"
            />
            {input && (!input.control || !input.showControl) && (
              <div className="input-title" data-testid="input-title">{input?.label}</div>
            )}
            {input?.control && input?.showControl && (
              <RefControl
                key={key}
                name="input-control"
                emit={emit}
                payload={input.control}
                data-testid="input-control"
              />
            )
            }
          </div>
      ))}
      <DataflowNodePlot
        display={showPlot}
        model={model}
        recordedTicks={reteManager.recordedTicks}
      />

    </div>
  );
});
