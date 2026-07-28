import { observer } from "mobx-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useReadOnlyContext } from "../../../../components/document/read-only-context";
import { GroupInputSocket, GroupOutputSocket, ReteManager } from "../../nodes/rete-manager";
import { IGroupModel } from "../../model/dataflow-program-model";

import "./dataflow-groups-overlay.scss";

const kPadding = 10;      // px padding around member nodes (expanded box)
const kNodeWidth = 140;   // px content width of the collapsed "group node" (scaled by zoom, see below)

type Point = { x: number; y: number };
type ScreenBounds = { left: number; top: number; width: number; height: number };
type SetSocketRef = (key: string, el: HTMLElement | null) => void;
type GroupInterface = { inputs: GroupInputSocket[]; outputs: GroupOutputSocket[] };

// Simple horizontal cubic bezier between two points (matches the look of node wires).
function wirePath(a: Point, b: Point) {
  const dx = Math.max(30, Math.abs(b.x - a.x) / 2);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

// Socket-ref keys — stable per member socket so the wire effect can find each dot after layout.
const inRefKey = (groupId: string, s: GroupInputSocket) => `${groupId}:in:${s.nodeId}:${s.key}`;
const outRefKey = (groupId: string, s: GroupOutputSocket) => `${groupId}:out:${s.nodeId}:${s.key}`;

// A collapsed chip is keyboard-navigable like a real node: Tab lands on the chip, arrows rove through
// its toggle + proxy sockets, and Enter/Space (or a click) on a proxy socket starts/commits a
// connection routed to the underlying member socket via the same connection mode real sockets use.
// This mirrors the block-level roving in dataflow-node.tsx.
const CHIP_INTERACTIVE_SELECTOR = ".dataflow-group-toggle,[data-socket-side]";

function chipInteractives(el: HTMLElement): HTMLElement[] {
  const chip = el.closest<HTMLElement>(".dataflow-group-node");
  return chip ? Array.from(chip.querySelectorAll<HTMLElement>(CHIP_INTERACTIVE_SELECTOR)) : [];
}

// Roving focus among a chip's interactives on Arrow/Home/End (attached to each interactive).
function roveChip(e: React.KeyboardEvent<HTMLElement>) {
  if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(e.key)) return;
  const items = chipInteractives(e.currentTarget);
  const i = items.indexOf(e.currentTarget);
  if (i < 0) return;
  e.preventDefault();
  e.stopPropagation();
  let next: number;
  switch (e.key) {
    case "Home":      next = 0; break;
    case "End":       next = items.length - 1; break;
    case "ArrowLeft":
    case "ArrowUp":   next = (i - 1 + items.length) % items.length; break;
    default:          next = (i + 1) % items.length; break;
  }
  items[next].focus();
}

// Arrow/Home/End on the chip container itself enters the roving cycle at the first/last interactive.
function handleChipKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  if (e.target !== e.currentTarget) return;
  if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(e.key)) return;
  const items = chipInteractives(e.currentTarget);
  if (items.length === 0) return;
  e.preventDefault();
  e.stopPropagation();
  const goLast = e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "End";
  items[goLast ? items.length - 1 : 0].focus();
}

// Start a connection from a proxy output, or commit to a proxy input when one is in progress —
// delegating to the member node + socket so the real connection is created.
function connectFromProxy(
  reteManager: ReteManager, nodeId: string, socketKey: string, side: "input" | "output"
) {
  if (side === "output") reteManager.beginConnectingFrom(nodeId, socketKey);
  else reteManager.commitConnectingTo(nodeId, socketKey);
}

function handleProxySocketKeyDown(
  e: React.KeyboardEvent<HTMLSpanElement>,
  reteManager: ReteManager, nodeId: string, socketKey: string, side: "input" | "output"
) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    e.stopPropagation();
    connectFromProxy(reteManager, nodeId, socketKey, side);
    return;
  }
  roveChip(e);
}

interface IGroupLabelProps {
  group: IGroupModel;
}

// Editable, multi-line group label. Labels double as code comments, so they wrap.
const GroupLabel = observer(function GroupLabel({ group }: IGroupLabelProps) {
  const readOnly = useReadOnlyContext();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.label);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) group.setLabel(trimmed); else setDraft(group.label);
    setEditing(false);
  };

  if (editing && !readOnly) {
    return (
      <textarea
        className="dataflow-group-label-input"
        data-testid="dataflow-group-label-input"
        value={draft}
        autoFocus
        rows={1}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
          else if (e.key === "Escape") { setDraft(group.label); setEditing(false); }
        }}
      />
    );
  }
  return (
    <span
      className="dataflow-group-label"
      onClick={() => { if (!readOnly) { setDraft(group.label); setEditing(true); } }}
    >
      {group.label}
    </span>
  );
});

interface IExpandedGroupBoxProps {
  group: IGroupModel;
  bounds: ScreenBounds;   // screen-space bounds of the members
  reteManager: ReteManager;
}

// Expanded: a bordered box around the members with a floating label bar and a collapse toggle. Positioned
// in screen space (its size already tracks zoom because the member bounds are measured in screen pixels).
const ExpandedGroupBox = observer(function ExpandedGroupBox({ group, bounds, reteManager }: IExpandedGroupBoxProps) {
  const style: React.CSSProperties = {
    left: bounds.left - kPadding,
    top: bounds.top - kPadding,
    width: bounds.width + kPadding * 2,
    height: bounds.height + kPadding * 2,
  };
  return (
    <div className="dataflow-group-box" style={style} data-testid="dataflow-group-box">
      <div className="dataflow-group-label-bar">
        <button
          type="button"
          className="dataflow-group-toggle"
          title="Collapse group"
          data-testid="dataflow-group-collapse"
          onClick={() => reteManager.toggleGroupCollapsed(group.id)}
        >
          ▾
        </button>
        <GroupLabel group={group} />
      </div>
    </div>
  );
});

interface ICollapsedGroupNodeProps {
  group: IGroupModel;
  left: number;
  top: number;
  scale: number;
  inputs: GroupInputSocket[];
  outputs: GroupOutputSocket[];
  reteManager: ReteManager;
  setSocketRef: SetSocketRef;
}

// Collapsed: a node-styled box that auto-sizes to its (wrapping) comment label, with a proxy socket per
// exposed member socket (inputs on the left, outputs on the right) — including open ones, so the group
// stays connectable. The chip's content has fixed pixel dimensions; a `scale(zoom)` transform (anchored at
// the top-left screen position) makes it grow/shrink with the canvas exactly like a real node.
const CollapsedGroupNode = observer(function CollapsedGroupNode(
  { group, left, top, scale, inputs, outputs, reteManager, setSocketRef }: ICollapsedGroupNodeProps
) {
  const rows = Math.max(inputs.length, outputs.length, 1);
  return (
    <div
      className="dataflow-group-node"
      style={{ left, top, width: kNodeWidth, transform: `scale(${scale})`, transformOrigin: "top left" }}
      data-testid="dataflow-group-node"
      tabIndex={0}
      role="group"
      aria-roledescription="collapsed group"
      aria-label={`Collapsed group: ${group.label}`}
      onKeyDown={handleChipKeyDown}
    >
      <div className="dataflow-group-node-header">
        <button
          type="button"
          className="dataflow-group-toggle"
          title="Expand group"
          data-testid="dataflow-group-expand"
          onClick={() => reteManager.toggleGroupCollapsed(group.id)}
          onKeyDown={roveChip}
        >
          ▸
        </button>
        <GroupLabel group={group} />
      </div>
      <div className="dataflow-group-node-body">
        {Array.from({ length: rows }, (_, i) => {
          const inp = inputs[i];
          const out = outputs[i];
          return (
            <div className="dataflow-group-node-row" key={i}>
              {inp &&
                <span className="dataflow-group-socket input"
                  role="button" tabIndex={-1}
                  aria-label={`Group input socket ${i + 1}`}
                  data-group-proxy="true" data-socket-side="input"
                  data-node-id={inp.nodeId} data-socket-key={inp.key}
                  onClick={() => connectFromProxy(reteManager, inp.nodeId, inp.key, "input")}
                  onKeyDown={e => handleProxySocketKeyDown(e, reteManager, inp.nodeId, inp.key, "input")}
                  ref={el => setSocketRef(inRefKey(group.id, inp), el)} />}
              {out &&
                <span className="dataflow-group-socket output"
                  role="button" tabIndex={-1}
                  aria-label={`Group output socket ${i + 1}`}
                  data-group-proxy="true" data-socket-side="output"
                  data-node-id={out.nodeId} data-socket-key={out.key}
                  onClick={() => connectFromProxy(reteManager, out.nodeId, out.key, "output")}
                  onKeyDown={e => handleProxySocketKeyDown(e, reteManager, out.nodeId, out.key, "output")}
                  ref={el => setSocketRef(outRefKey(group.id, out), el)} />}
            </div>
          );
        })}
      </div>
    </div>
  );
});

interface IProps {
  reteManager: ReteManager;
}

// Draws each group (expanded box, or collapsed group-node with routed boundary wires) over the
// .flow-tool in screen space. Re-renders as the canvas changes by observing zoom + node positions;
// boundary wires are measured (both ends relative to this overlay) after layout so they align.
export const DataflowGroupsOverlay = observer(function DataflowGroupsOverlay({ reteManager }: IProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const socketRefs = useRef<Map<string, HTMLElement>>(new Map());
  // Collapsed groups' interfaces, computed once per render for the signature below and reused by the
  // wire-measurement effect (avoids computing getGroupInterface twice per render).
  const interfacesRef = useRef<Map<string, GroupInterface>>(new Map());
  const [wires, setWires] = useState<string[]>([]);

  const setSocketRef: SetSocketRef = useCallback((key, el) => {
    if (el) socketRefs.current.set(key, el); else socketRefs.current.delete(key);
  }, []);

  // Observe pan/zoom so this re-renders (and re-measures wires) on any canvas change. Read scale/dx/dy
  // from the observable liveProgramZoom (updated on every pan and zoom event). Reading the transform
  // directly (without subscribing) would miss a zoom that changes only the scale, not the translation,
  // and the expanded box would stop scaling. `getGroupScreenBounds` still reads the live transform
  // directly, so bounds stay current mid-gesture.
  const zoom = reteManager.mstContent.liveProgramZoom;
  const scale = zoom?.scale ?? 1;
  const dx = zoom?.dx ?? 0, dy = zoom?.dy ?? 0;

  // Build a signature of everything that can move a wire endpoint (zoom, group identity/label/size,
  // member positions, exposed-socket wiring) so the effect below re-measures wires only when needed.
  // Items are built here in the parent (not in a memoized per-group child) so they re-render whenever the
  // parent does — i.e. on any pan/zoom (observed via liveProgramZoom) — and reposition via the live
  // transform. (A per-group observer would skip re-rendering on pan since its props wouldn't change.)
  const groups = [...reteManager.groups.values()];
  const items: JSX.Element[] = [];
  const interfaces = new Map<string, GroupInterface>();
  const positionKeys: string[] = [];
  const observePosition = (id: string) => {
    const n = reteManager.nodes.get(id);
    if (n) positionKeys.push(`${n.currentX},${n.currentY}`);
  };

  let collapsedKey = "";
  for (const group of groups) {
    const memberIds = [...group.nodeIds.keys()];
    // A collapsed group-node auto-sizes to its (wrapping) label, so a label edit changes the header
    // height and shifts the socket rows — the wires must then re-measure.
    collapsedKey += `${group.id}:${group.collapsed}:${group.nodeIds.size}:${group.label};`;
    memberIds.forEach(observePosition);
    const bounds = reteManager.getGroupScreenBounds(memberIds);
    if (!bounds) continue;

    if (!group.collapsed) {
      items.push(
        <ExpandedGroupBox key={group.id} group={group} bounds={bounds} reteManager={reteManager} />
      );
      continue;
    }

    const iface = reteManager.getGroupInterface(memberIds);
    interfaces.set(group.id, iface);
    iface.inputs.forEach(s => { if (s.external) observePosition(s.external.externalNodeId); });
    iface.outputs.forEach(s => s.externals.forEach(e => observePosition(e.externalNodeId)));
    // Include the exposed-socket identity (member socket + its external connections) so wires
    // re-measure when a socket is added/removed/rerouted even if no node position changed.
    const ifaceKey = [
      ...iface.inputs.map(s => `${s.nodeId}.${s.key}<${s.external?.connId ?? "open"}`),
      ...iface.outputs.map(s => `${s.nodeId}.${s.key}>${s.externals.map(e => e.connId).join("+") || "open"}`),
    ].join(",");
    collapsedKey += `iface:${ifaceKey};`;
    items.push(
      <CollapsedGroupNode
        key={group.id}
        group={group}
        left={bounds.left}
        top={bounds.top}
        scale={scale}
        inputs={iface.inputs}
        outputs={iface.outputs}
        reteManager={reteManager}
        setSocketRef={setSocketRef}
      />
    );
  }
  interfacesRef.current = interfaces;
  const signature = `${scale}:${dx}:${dy}|${collapsedKey}|${positionKeys.join("|")}`;

  // Re-measure the collapsed groups' boundary wires after layout whenever the signature changes.
  useEffect(() => {
    const overlayEl = overlayRef.current;
    if (!overlayEl) { setWires([]); return; }
    const origin = overlayEl.getBoundingClientRect();
    const center = (el: HTMLElement): Point => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - origin.left, y: r.top + r.height / 2 - origin.top };
    };
    const paths: string[] = [];
    interfacesRef.current.forEach(({ inputs, outputs }, groupId) => {
      // Open sockets get a dot but no wire; external-facing ones route to the outside node's socket.
      inputs.forEach(s => {
        if (!s.external) return;
        const extEl = reteManager.getSocketElement(s.external.externalNodeId, s.external.externalKey, "output");
        const grpEl = socketRefs.current.get(inRefKey(groupId, s));
        if (extEl && grpEl) paths.push(wirePath(center(extEl), center(grpEl)));
      });
      outputs.forEach(s => {
        const grpEl = socketRefs.current.get(outRefKey(groupId, s));
        if (!grpEl) return;
        s.externals.forEach(e => {
          const extEl = reteManager.getSocketElement(e.externalNodeId, e.externalKey, "input");
          if (extEl) paths.push(wirePath(center(grpEl), center(extEl)));
        });
      });
    });
    setWires(paths);
  }, [reteManager, signature]);

  return (
    <div
      className="dataflow-groups-overlay"
      ref={overlayRef}
      data-testid="dataflow-groups-overlay"
      data-signature={signature}
    >
      {wires.length > 0 &&
        <svg
          className="dataflow-group-wires"
          style={{ strokeWidth: 2 * scale, strokeDasharray: `${5 * scale} ${3 * scale}` }}
        >
          {wires.map((d, i) => <path key={i} d={d} />)}
        </svg>}
      {items}
    </div>
  );
});
