import { observer } from "mobx-react";
import React, { useState } from "react";
import { ReteManager } from "../../nodes/rete-manager";
import { IGroupModel } from "../../model/dataflow-program-model";

import "./dataflow-groups-overlay.scss";

const kPadding = 10;  // px padding around member nodes

type Bounds = { left: number; top: number; width: number; height: number };

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

interface IGroupProps {
  group: IGroupModel;
  bounds: Bounds;
  reteManager: ReteManager;
  readOnly?: boolean;
}

// Expanded: a bordered box around the members with a label bar that floats above it (growing
// upward as the label wraps) and a collapse toggle.
const ExpandedGroupBox = observer(function ExpandedGroupBox({ group, bounds, reteManager, readOnly }: IGroupProps) {
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

// Collapsed: a compact labeled chip with an expand toggle, so the group stays visible/reopenable.
const CollapsedGroupChip = observer(function CollapsedGroupChip({ group, bounds, reteManager, readOnly }: IGroupProps) {
  const style: React.CSSProperties = { left: bounds.left, top: bounds.top };
  return (
    <div className="dataflow-group-chip" style={style} data-testid="dataflow-group-chip">
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
  );
});

interface IProps {
  reteManager?: ReteManager;
  readOnly?: boolean;
}

// Draws each group (expanded box or collapsed chip) over the .flow-tool in screen space. Re-renders
// as the canvas changes by observing the live program zoom and member node positions.
export const DataflowGroupsOverlay = observer(function DataflowGroupsOverlay({ reteManager, readOnly }: IProps) {
  if (!reteManager) return null;

  // Observe pan/zoom so the boxes track the canvas.
  const { scale, dx, dy } = reteManager.mstContent.liveProgramZoom;

  const items: JSX.Element[] = [];
  reteManager.groups.forEach(group => {
    // Observe member positions so boxes track node drags (getGroupScreenBounds reads the DOM).
    const memberPositions = [...group.nodeIds].map(id => {
      const n = reteManager.nodes.get(id);
      if (!n) return "";
      const x = isNaN(n.liveX) ? n.x : n.liveX;
      const y = isNaN(n.liveY) ? n.y : n.liveY;
      return `${x},${y}`;
    }).join("|");
    const bounds = reteManager.getGroupScreenBounds([...group.nodeIds]);
    if (!bounds) return;
    const key = `${group.id}:${memberPositions}`;
    items.push(group.collapsed
      ? <CollapsedGroupChip key={key} group={group} bounds={bounds} reteManager={reteManager} readOnly={readOnly} />
      : <ExpandedGroupBox key={key} group={group} bounds={bounds} reteManager={reteManager} readOnly={readOnly} />
    );
  });

  return (
    <div
      className="dataflow-groups-overlay"
      data-testid="dataflow-groups-overlay"
      data-zoom={`${scale}:${dx}:${dy}`}
    >
      {items}
    </div>
  );
});
