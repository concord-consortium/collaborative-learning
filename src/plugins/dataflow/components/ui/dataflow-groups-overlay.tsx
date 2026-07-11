import { observer } from "mobx-react";
import React, { useState } from "react";
import { ReteManager } from "../../nodes/rete-manager";
import { IGroupModel } from "../../model/dataflow-program-model";

import "./dataflow-groups-overlay.scss";

const kPadding = 10;   // px padding around member nodes
const kLabelBar = 22;  // px height of the label bar above the box

interface IGroupBoxProps {
  group: IGroupModel;
  bounds: { left: number; top: number; width: number; height: number };
  reteManager: ReteManager;
  readOnly?: boolean;
}

const DataflowGroupBox = observer(function DataflowGroupBox(
  { group, bounds, reteManager, readOnly }: IGroupBoxProps
) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.label);

  const boxStyle: React.CSSProperties = {
    left: bounds.left - kPadding,
    top: bounds.top - kPadding - kLabelBar,
    width: bounds.width + kPadding * 2,
    height: bounds.height + kPadding * 2 + kLabelBar,
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) group.setLabel(trimmed);
    else setDraft(group.label);
    setEditing(false);
  };

  const startEdit = () => {
    if (readOnly) return;
    setDraft(group.label);
    setEditing(true);
  };

  return (
    <div className="dataflow-group-box" style={boxStyle} data-testid="dataflow-group-box">
      <div className="dataflow-group-label-bar">
        <button
          type="button"
          className="dataflow-group-collapse"
          title="Collapse group"
          data-testid="dataflow-group-collapse"
          onClick={() => reteManager.toggleGroupCollapsed(group.id)}
        >
          ▾
        </button>
        {editing && !readOnly
          ? <input
              className="dataflow-group-label-input"
              data-testid="dataflow-group-label-input"
              value={draft}
              autoFocus
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); commit(); }
                else if (e.key === "Escape") { setDraft(group.label); setEditing(false); }
              }}
            />
          : <span className="dataflow-group-label" onClick={startEdit}>{group.label}</span>}
      </div>
    </div>
  );
});

interface IProps {
  reteManager?: ReteManager;
  readOnly?: boolean;
}

// Draws a labeled, collapsible box around each expanded group's member nodes, positioned in screen
// space over the .flow-tool. It re-renders as the canvas changes by observing the live program zoom
// and member node positions (getGroupScreenBounds itself reads the measured DOM). Collapsed groups
// are rendered by the rete editor as a single node, not here.
export const DataflowGroupsOverlay = observer(function DataflowGroupsOverlay(
  { reteManager, readOnly }: IProps
) {
  if (!reteManager) return null;

  // Observe pan/zoom so boxes track the canvas.
  const { scale, dx, dy } = reteManager.mstContent.liveProgramZoom;

  const boxes: JSX.Element[] = [];
  reteManager.groups.forEach(group => {
    if (group.collapsed) return;
    // Observe member positions so boxes track node drags.
    const memberPositions = [...group.nodeIds].map(id => {
      const n = reteManager.nodes.get(id);
      if (!n) return "";
      const x = isNaN(n.liveX) ? n.x : n.liveX;
      const y = isNaN(n.liveY) ? n.y : n.liveY;
      return `${x},${y}`;
    }).join("|");
    const bounds = reteManager.getGroupScreenBounds([...group.nodeIds]);
    if (!bounds) return;
    boxes.push(
      <DataflowGroupBox
        key={`${group.id}:${memberPositions}`}
        group={group}
        bounds={bounds}
        reteManager={reteManager}
        readOnly={readOnly}
      />
    );
  });

  return (
    <div
      className="dataflow-groups-overlay"
      data-testid="dataflow-groups-overlay"
      data-zoom={`${scale}:${dx}:${dy}`}
    >
      {boxes}
    </div>
  );
});
