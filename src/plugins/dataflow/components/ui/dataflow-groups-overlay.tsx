import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";
import { GroupInputSocket, GroupOutputSocket, ReteManager } from "../../nodes/rete-manager";
import { IGroupModel } from "../../model/dataflow-program-model";

import "./dataflow-groups-overlay.scss";

const kPadding = 10;      // px padding around member nodes (expanded box)
const kNodeWidth = 140;   // px fixed width of the collapsed "group node"

type Point = { x: number; y: number };
type SetSocketRef = (key: string, el: HTMLElement | null) => void;

// Simple horizontal cubic bezier between two points (matches the look of node wires).
function wirePath(a: Point, b: Point) {
  const dx = Math.max(30, Math.abs(b.x - a.x) / 2);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

// Editable, multi-line group label. Labels double as code comments, so they wrap.
const GroupLabel = observer(function GroupLabel({ group, readOnly }: { group: IGroupModel; readOnly?: boolean }) {
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

// Expanded: a bordered box around the members with a floating label bar and a collapse toggle.
const ExpandedGroupBox = observer(function ExpandedGroupBox(
  { group, bounds, reteManager, readOnly }:
  { group: IGroupModel; bounds: { left: number; top: number; width: number; height: number };
    reteManager: ReteManager; readOnly?: boolean }
) {
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
        <GroupLabel group={group} readOnly={readOnly} />
      </div>
    </div>
  );
});

// Socket-ref keys — stable per member socket so the wire effect can find each dot after layout.
const inRefKey = (groupId: string, s: GroupInputSocket) => `${groupId}:in:${s.nodeId}:${s.key}`;
const outRefKey = (groupId: string, s: GroupOutputSocket) => `${groupId}:out:${s.nodeId}:${s.key}`;

// Collapsed: a node-styled box that auto-sizes to its (wrapping) comment label, with a proxy socket
// per exposed member socket (inputs on the left, outputs on the right) — including open ones, so the
// group stays connectable. The overlay measures the dots to route boundary wires, so socket
// positions can follow the label height.
const CollapsedGroupNode = observer(function CollapsedGroupNode(
  { group, left, top, inputs, outputs, reteManager, readOnly, setSocketRef }:
  { group: IGroupModel; left: number; top: number;
    inputs: GroupInputSocket[]; outputs: GroupOutputSocket[];
    reteManager: ReteManager; readOnly?: boolean; setSocketRef: SetSocketRef }
) {
  const rows = Math.max(inputs.length, outputs.length, 1);
  return (
    <div
      className="dataflow-group-node"
      style={{ left, top, width: kNodeWidth }}
      data-testid="dataflow-group-node"
    >
      <div className="dataflow-group-node-header">
        <button
          type="button"
          className="dataflow-group-toggle"
          title="Expand group"
          data-testid="dataflow-group-expand"
          onClick={() => reteManager.toggleGroupCollapsed(group.id)}
        >
          ▸
        </button>
        <GroupLabel group={group} readOnly={readOnly} />
      </div>
      <div className="dataflow-group-node-body">
        {Array.from({ length: rows }, (_, i) => (
          <div className="dataflow-group-node-row" key={i}>
            {inputs[i] &&
              <span className="dataflow-group-socket input"
                ref={el => setSocketRef(inRefKey(group.id, inputs[i]), el)} />}
            {outputs[i] &&
              <span className="dataflow-group-socket output"
                ref={el => setSocketRef(outRefKey(group.id, outputs[i]), el)} />}
          </div>
        ))}
      </div>
    </div>
  );
});

interface IProps {
  reteManager?: ReteManager;
  readOnly?: boolean;
}

// Draws each group (expanded box, or collapsed group-node with routed boundary wires) over the
// .flow-tool in screen space. Re-renders as the canvas changes by observing zoom + node positions;
// boundary wires are measured (both ends relative to this overlay) after layout so they align.
export const DataflowGroupsOverlay = observer(function DataflowGroupsOverlay({ reteManager, readOnly }: IProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const socketRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [wires, setWires] = useState<string[]>([]);

  const setSocketRef: SetSocketRef = (key, el) => {
    if (el) socketRefs.current.set(key, el); else socketRefs.current.delete(key);
  };

  // Observe pan/zoom + node positions so the measurement effect re-runs on any canvas change.
  const zoom = reteManager?.mstContent.liveProgramZoom;
  const scale = zoom?.scale ?? 1, dx = zoom?.dx ?? 0, dy = zoom?.dy ?? 0;

  const items: JSX.Element[] = [];
  const positionKeys: string[] = [];
  const observePosition = (id: string) => {
    const n = reteManager?.nodes.get(id);
    if (n) positionKeys.push(`${isNaN(n.liveX) ? n.x : n.liveX},${isNaN(n.liveY) ? n.y : n.liveY}`);
  };

  let collapsedKey = "";
  reteManager?.groups.forEach(group => {
    // Include the label: a collapsed group-node auto-sizes to its (wrapping) label, so a label edit
    // changes the header height and shifts the socket rows — the wires must then re-measure.
    collapsedKey += `${group.id}:${group.collapsed}:${group.nodeIds.length}:${group.label};`;
    group.nodeIds.forEach(observePosition);
    const bounds = reteManager.getGroupScreenBounds([...group.nodeIds]);
    if (!bounds) return;

    if (!group.collapsed) {
      items.push(
        <ExpandedGroupBox key={group.id} group={group} bounds={bounds} reteManager={reteManager} readOnly={readOnly} />
      );
      return;
    }

    const { inputs, outputs } = reteManager.getGroupInterface([...group.nodeIds]);
    inputs.forEach(s => { if (s.external) observePosition(s.external.externalNodeId); });
    outputs.forEach(s => s.externals.forEach(e => observePosition(e.externalNodeId)));
    // Include the exposed-socket identity (member socket + its external connections) so wires
    // re-measure when a socket is added/removed/rerouted even if no node position changed.
    const ifaceKey = [
      ...inputs.map(s => `${s.nodeId}.${s.key}<${s.external?.connId ?? "open"}`),
      ...outputs.map(s => `${s.nodeId}.${s.key}>${s.externals.map(e => e.connId).join("+") || "open"}`),
    ].join(",");
    collapsedKey += `iface:${ifaceKey};`;
    items.push(
      <CollapsedGroupNode
        key={group.id}
        group={group}
        left={bounds.left}
        top={bounds.top}
        inputs={inputs}
        outputs={outputs}
        reteManager={reteManager}
        readOnly={readOnly}
        setSocketRef={setSocketRef}
      />
    );
  });

  // Signature of everything that can move a wire endpoint; re-measure after layout when it changes.
  const signature = `${scale}:${dx}:${dy}|${collapsedKey}|${positionKeys.join("|")}`;

  useEffect(() => {
    const overlayEl = overlayRef.current;
    if (!reteManager || !overlayEl) { setWires([]); return; }
    const origin = overlayEl.getBoundingClientRect();
    const center = (el: HTMLElement): Point => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - origin.left, y: r.top + r.height / 2 - origin.top };
    };
    const paths: string[] = [];
    reteManager.groups.forEach(group => {
      if (!group.collapsed) return;
      const { inputs, outputs } = reteManager.getGroupInterface([...group.nodeIds]);
      // Open sockets get a dot but no wire; external-facing ones route to the outside node's socket.
      inputs.forEach(s => {
        if (!s.external) return;
        const extEl = reteManager.getSocketElement(s.external.externalNodeId, s.external.externalKey, "output");
        const grpEl = socketRefs.current.get(inRefKey(group.id, s));
        if (extEl && grpEl) paths.push(wirePath(center(extEl), center(grpEl)));
      });
      outputs.forEach(s => {
        const grpEl = socketRefs.current.get(outRefKey(group.id, s));
        if (!grpEl) return;
        s.externals.forEach(e => {
          const extEl = reteManager.getSocketElement(e.externalNodeId, e.externalKey, "input");
          if (extEl) paths.push(wirePath(center(grpEl), center(extEl)));
        });
      });
    });
    setWires(paths);
  }, [reteManager, signature]);

  if (!reteManager) return null;

  return (
    <div
      className="dataflow-groups-overlay"
      ref={overlayRef}
      data-testid="dataflow-groups-overlay"
      data-signature={signature}
    >
      {wires.length > 0 &&
        <svg className="dataflow-group-wires">
          {wires.map((d, i) => <path key={i} d={d} />)}
        </svg>}
      {items}
    </div>
  );
});
