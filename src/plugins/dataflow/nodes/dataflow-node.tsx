import * as React from "react";
import { observer } from "mobx-react";
import { isAlive } from "mobx-state-tree";
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

// Keyboard-actionable descendants of a block, returned in DOM order. Hand-curated
// rather than reusing `getVisibleFocusables` because every entry here has
// `tabindex="-1"` (composite-widget pattern) — the standard focusable selector
// excludes those by design.
const BLOCK_INTERACTIVE_SELECTOR = [
  '.close-node-button',
  '.node-name-input',
  '[data-socket-side]',
  '.number-input',
  '.number-container select',
  '.node-select > button',
  '.graph-button',
].join(',');

export function getBlockInteractives(blockEl: HTMLElement): HTMLElement[] {
  return Array.from(blockEl.querySelectorAll<HTMLElement>(BLOCK_INTERACTIVE_SELECTOR));
}

function isTextEditingTarget(el: EventTarget | null): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) return false;
  return el.type === "text" || el.type === "number" || el.type === "search";
}

/**
 * Roving in-block focus handler. Attach to every keyboard-actionable descendant
 * of a block (the elements matched by `BLOCK_INTERACTIVE_SELECTOR`). Cycles focus
 * within the closest `.node` ancestor on Arrow/Home/End. Tab/Shift+Tab are left
 * to native handling so they leave the block entirely.
 *
 * Text inputs keep ArrowLeft/ArrowRight for cursor movement; ArrowUp/Down/Home/End
 * still rove out of the input.
 */
export function handleBlockChildKeyDown(e: React.KeyboardEvent<HTMLElement>) {
  if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(e.key)) return;
  if (isTextEditingTarget(e.target) && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;

  const blockEl = e.currentTarget.closest<HTMLElement>('.node');
  if (!blockEl) return;
  const interactives = getBlockInteractives(blockEl);
  if (interactives.length === 0) return;
  const i = interactives.indexOf(e.currentTarget);
  if (i < 0) return;

  e.preventDefault();
  e.stopPropagation();
  let next: number;
  switch (e.key) {
    case "Home":      next = 0; break;
    case "End":       next = interactives.length - 1; break;
    case "ArrowLeft":
    case "ArrowUp":   next = (i - 1 + interactives.length) % interactives.length; break;
    default:          next = (i + 1) % interactives.length; break; // ArrowRight, ArrowDown
  }
  interactives[next].focus();
}

function handleNodeKeyDown(
  e: React.KeyboardEvent<HTMLDivElement>,
  node: IBaseNode,
  reteManager: ReteManager
) {
  // Don't intercept keys that originate from interactive descendants — those have
  // their own roving handler. The block container only handles keys when it is
  // itself the focus target.
  if (e.target !== e.currentTarget) return;

  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    reteManager.selectNode(node.id);
    reteManager.announce(`Selected ${node.model.type} block ${node.model.orderedDisplayName}`);
    return;
  }

  // Arrow keys on the block container itself enter the in-block cycle: ArrowRight/
  // ArrowDown/Home land on the first interactive descendant; ArrowLeft/ArrowUp/End
  // land on the last. Block-to-block navigation is via Tab.
  if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(e.key)) {
    const interactives = getBlockInteractives(e.currentTarget);
    if (interactives.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const goLast = e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "End";
    interactives[goLast ? interactives.length - 1 : 0].focus();
  }
}

function handleSocketKeyDown(
  e: React.KeyboardEvent<HTMLDivElement>,
  nodeId: string,
  socketKey: string,
  side: "input" | "output",
  reteManager: ReteManager
) {
  if (e.target !== e.currentTarget) return;
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  e.stopPropagation();
  if (side === "output") {
    reteManager.beginConnectingFrom(nodeId, socketKey);
  } else {
    // Input-side Enter only commits when in connecting mode; otherwise it's a no-op.
    reteManager.commitConnectingTo(nodeId, socketKey);
  }
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
  function CustomDataflowNode<Scheme extends ClassicScheme>(
    {data, styles, emit, reteManager}: Props<Scheme>)
{
  const inputs = Object.entries(data.inputs);
  const outputs = Object.entries(data.outputs);
  const controls = Object.entries(data.controls);
  const { id } = data;

  // FIXME: update 'Scheme' so we don't have to typecast here
  const node = (data as unknown as IBaseNode);
  const model = node.model;

  // The node model might be destroyed if the node was removed from the program
  if (!isAlive(model)) return null;

  const nodeLetter = getNodeLetter(model.type);

  const showPlot = model.plot;

  sortByIndex(inputs);
  sortByIndex(outputs);
  sortByIndex(controls);

  // Members of a collapsed group are hidden (the group renders as a chip in the overlay). Reading
  // the observable groups here keeps this reactive to collapse/expand and membership changes.
  const inCollapsedGroup = !!reteManager
    && [...reteManager.groups.values()].some(g => g.collapsed && g.nodeIds.includes(id));

  const dynamicClasses = classNames({
    "selected": data.selected,
    "gate-active": node instanceof ControlNode && node.model.gateActive,
    "has-flow-in": node instanceof ControlNode && node.hasFlowIn(),
    "plot-open": showPlot,
    "collapsed-hidden": inCollapsedGroup,
  });

  return (
    <div
      className={`node ${model.type.toLowerCase().replace(/ /g, "-")} ${dynamicClasses}`}
      data-testid="node"
      tabIndex={0}
      role="group"
      aria-roledescription="block"
      aria-label={`${model.type} block: ${model.orderedDisplayName}`}
      onKeyDown={e => handleNodeKeyDown(e, node, reteManager)}
    >
      <div className="top-bar">
        {!node.readOnly && <Delete reteManager={reteManager} nodeId={id}/>}
      </div>

      <div className="node-type-letter">{nodeLetter}</div>

      <EditableNodeName node={node} />

      {/* Outputs */}
      {outputs.map(([key, output]) => (
        output &&
          <div
            className="output"
            key={key}
            data-testid={`output-${key}`}
            tabIndex={-1}
            role="button"
            aria-label={`Output socket: ${output?.label ?? key}`}
            data-socket-side="output"
            data-node-id={id}
            data-socket-key={key}
            onKeyDown={e => {
              handleSocketKeyDown(e, id, key, "output", reteManager);
              if (!e.defaultPrevented) handleBlockChildKeyDown(e);
            }}
          >
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
          <div
            className={inputClass(input.label)}
            key={key}
            data-testid={`input-${key}`}
            tabIndex={-1}
            role="button"
            aria-label={`Input socket: ${input?.label ?? key}`}
            data-socket-side="input"
            data-node-id={id}
            data-socket-key={key}
            onKeyDown={e => {
              handleSocketKeyDown(e, id, key, "input", reteManager);
              if (!e.defaultPrevented) handleBlockChildKeyDown(e);
            }}
          >
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
