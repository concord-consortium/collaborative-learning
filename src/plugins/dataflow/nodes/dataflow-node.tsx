import * as React from "react";
import { observer } from "mobx-react";
import styled, { css } from "styled-components";
import { ClassicScheme, RenderEmit, Presets } from "rete-react-plugin";
import { BaseAreaPlugin } from "rete-area-plugin";

import { $nodecolor, $nodecolorselected, $nodewidth, $socketmargin, $socketsize } from "./vars";
import { DataflowNodePlot } from "./dataflow-node-plot";
import { IBaseNode } from "./base-node";
import { NodeEditorMST } from "./node-editor-mst";
import { Delete } from "./delete";

const { RefSocket, RefControl } = Presets.classic;


type NodeExtraData = { width?: number, height?: number }

export const DataflowNodeStyles = styled.div<NodeExtraData & { selected: boolean, styles?: (props: any) => any }>`
    background: ${$nodecolor};
    border: 2px solid #4e58bf;
    border-radius: 10px;
    cursor: pointer;
    box-sizing: border-box;
    width: ${props => Number.isFinite(props.width) ? `${props.width}px` : `${$nodewidth}px`};
    height: ${props => Number.isFinite(props.height) ? `${props.height}px` : 'auto'};
    padding-bottom: 6px;
    position: relative;
    user-select: none;
    line-height: initial;
    font-family: Arial;

    &:hover {
        background: lighten(${$nodecolor},4%);
    }
    ${props => props.selected && css`
        background: ${$nodecolorselected};
        border-color: #e3c000;
    `}
    .title {
        color: white;
        font-family: sans-serif;
        font-size: 18px;
        padding: 8px;
    }
    .output {
        text-align: right;
    }
    .input {
        text-align: left;
    }
    .output-socket {
        text-align: right;
        margin-right: -${$socketsize / 2 + $socketmargin}px;
        display: inline-block;
    }
    .input-socket {
        text-align: left;
        margin-left: -${$socketsize / 2 + $socketmargin}px;
        display: inline-block;
    }
    .input-title,.output-title {
        vertical-align: middle;
        color: white;
        display: inline-block;
        font-family: sans-serif;
        font-size: 14px;
        margin: ${$socketmargin}px;
        line-height: ${$socketsize}px;
    }
    .input-control {
        z-index: 1;
        width: calc(100% - ${$socketsize + 2 * $socketmargin}px);
        vertical-align: middle;
        display: inline-block;
    }
    .control {
        display: block;
        padding: ${$socketmargin}px ${$socketsize / 2 + $socketmargin}px;
    }
    ${props => props.styles && props.styles(props)}
`;

function sortByIndex<T extends [string, undefined | { index?: number }][]>(entries: T) {
  entries.sort((a, b) => {
    const ai = a[1]?.index || 0;
    const bi = b[1]?.index || 0;

    return ai - bi;
  });
}

type Props<S extends ClassicScheme> = {
    data: S['Node'] & NodeExtraData
    styles?: () => any
    emit: RenderEmit<S>
    area: BaseAreaPlugin<S, any>
    editor: NodeEditorMST
}
export type DataflowNodeComponent<Scheme extends ClassicScheme> = (props: Props<Scheme>) => JSX.Element

// eslint-disable-next-line max-statements
export const CustomDataflowNode = observer(
  function CustomDataflowNode<Scheme extends ClassicScheme>({data, styles, emit, editor}: Props<Scheme>)
{
  const inputs = Object.entries(data.inputs);
  const outputs = Object.entries(data.outputs);
  const controls = Object.entries(data.controls);
  const selected = data.selected || false;
  const { id, label, width, height } = data;

  // FIXME: update 'Scheme' so we don't have to typecast here
  const model = (data as unknown as IBaseNode).model;

  const showPlot = model.plot;

  sortByIndex(inputs);
  sortByIndex(outputs);
  sortByIndex(controls);

  return (
    <DataflowNodeStyles
      className={`node ${model.type.toLowerCase().replace(/ /g, "-")}`}
      selected={selected}
      width={width}
      height={height}
      styles={styles}
      data-testid="node"
    >
      <div className="top-bar" onClick={() => console.log("top-bar click")}>
        <div className="title" data-testid="title">{model.orderedDisplayName || label}</div>
        <Delete editor={editor} nodeId={id}/>
      </div>
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
          <div className="input" key={key} data-testid={`input-${key}`}>
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
      />

    </DataflowNodeStyles>
  );
});
