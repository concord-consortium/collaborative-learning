import React from "react";
import { fireEvent, render, within } from "@testing-library/react";
import { ReadOnlyContext } from "../../../../components/document/read-only-context";
import { DataflowGroupsOverlay } from "./dataflow-groups-overlay";
import { DataflowNodeModel, DataflowProgramModel } from "../../model/dataflow-program-model";
import { ReteManager } from "../../rete/rete-manager";

// Required so the dataflow tile is registered before any rendering pulls in
// dataflow-types side effects.
import "../../dataflow-registration";

interface IRenderOptions {
  collapsed?: boolean;
  readOnly?: boolean;
  // Group interface returned for a collapsed group, as ReteManager.getGroupInterface would.
  iface?: { inputs: any[]; outputs: any[] };
  // Node ids for which getSocketElement resolves to an element (i.e. the far end is measurable).
  resolvableExternals?: string[];
}

/**
 * Renders the overlay over a real DataflowProgramModel with one group of two nodes, backed by a
 * ReteManager stub supplying just the accessors the overlay reads. Using the real model keeps the
 * MobX reactivity and the group actions (setLabel/setCollapsed) honest.
 */
function renderOverlay(opts: IRenderOptions = {}) {
  const program = DataflowProgramModel.create();
  ["n1", "n2", "n3"].forEach(id => program.addNode(
    DataflowNodeModel.create({ id, name: "Number", x: 0, y: 0, data: { type: "Number", value: 1 } })
  ));
  const group = program.createGroup(["n1", "n2"], "My Group")!;
  if (opts.collapsed) group.setCollapsed(true);

  const toggleGroupCollapsed = jest.fn((id: string) => {
    const g = program.groups.get(id);
    g?.setCollapsed(!g.collapsed);
  });

  const externalEl = document.createElement("span");
  const manager = {
    groups: program.groups,
    nodes: program.nodes,
    mstContent: { liveProgramZoom: { scale: 1, dx: 0, dy: 0 } },
    getGroupScreenBounds: () => ({ left: 100, top: 50, width: 200, height: 80 }),
    getGroupInterface: () => opts.iface ?? { inputs: [], outputs: [] },
    getSocketElement: (nodeId: string) =>
      (opts.resolvableExternals ?? []).includes(nodeId) ? externalEl : undefined,
    toggleGroupCollapsed,
  } as unknown as ReteManager;

  const utils = render(
    <ReadOnlyContext.Provider value={opts.readOnly ?? false}>
      <DataflowGroupsOverlay reteManager={manager} />
    </ReadOnlyContext.Provider>
  );
  return { ...utils, program, group, toggleGroupCollapsed };
}

describe("DataflowGroupsOverlay", () => {
  describe("expanded group", () => {
    it("draws a box around the members, padded, at the screen bounds", () => {
      const { getByTestId } = renderOverlay();
      const box = getByTestId("dataflow-group-box");
      // kPadding is 10, so the box is inset by 10 on each side and 20 larger in each dimension.
      expect(box).toHaveStyle({ left: "90px", top: "40px", width: "220px", height: "100px" });
    });

    it("collapses via the toggle", () => {
      const { getByTestId, toggleGroupCollapsed, group } = renderOverlay();
      fireEvent.click(getByTestId("dataflow-group-collapse"));
      expect(toggleGroupCollapsed).toHaveBeenCalledWith(group.id);
      expect(group.collapsed).toBe(true);
    });

    it("renders a collapsed group as a chip instead of a box", () => {
      const { queryByTestId, getByTestId } = renderOverlay({ collapsed: true });
      expect(queryByTestId("dataflow-group-box")).toBeNull();
      expect(getByTestId("dataflow-group-node")).toBeInTheDocument();
    });
  });

  describe("label editing", () => {
    it("commits a new label on Enter", () => {
      const { getByText, getByTestId, group } = renderOverlay();
      fireEvent.click(getByText("My Group"));
      const input = getByTestId("dataflow-group-label-input");
      fireEvent.change(input, { target: { value: "Renamed" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(group.label).toBe("Renamed");
    });

    it("keeps the label on Escape", () => {
      const { getByText, getByTestId, group } = renderOverlay();
      fireEvent.click(getByText("My Group"));
      const input = getByTestId("dataflow-group-label-input");
      fireEvent.change(input, { target: { value: "Discarded" } });
      fireEvent.keyDown(input, { key: "Escape" });
      expect(group.label).toBe("My Group");
    });

    it("commits on blur", () => {
      const { getByText, getByTestId, group } = renderOverlay();
      fireEvent.click(getByText("My Group"));
      const input = getByTestId("dataflow-group-label-input");
      fireEvent.change(input, { target: { value: "Via blur" } });
      fireEvent.blur(input);
      expect(group.label).toBe("Via blur");
    });

    it("rejects a blank label rather than saving an unlabeled group", () => {
      const { getByText, getByTestId, group } = renderOverlay();
      fireEvent.click(getByText("My Group"));
      const input = getByTestId("dataflow-group-label-input");
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(group.label).toBe("My Group");
    });

    it("does not open the editor when the document is read-only", () => {
      const { getByText, queryByTestId } = renderOverlay({ readOnly: true });
      fireEvent.click(getByText("My Group"));
      expect(queryByTestId("dataflow-group-label-input")).toBeNull();
    });
  });

  describe("collapsed chip", () => {
    const iface = {
      inputs: [{ nodeId: "n1", key: "num1", external: { connId: "c1", externalNodeId: "ext", externalKey: "out" } }],
      outputs: [
        { nodeId: "n2", key: "value", externals: [{ connId: "c2", externalNodeId: "ext2", externalKey: "in" }] },
      ],
    };

    it("renders a proxy socket per exposed member socket, tagged for lookup", () => {
      const { getByTestId } = renderOverlay({ collapsed: true, iface });
      const chip = getByTestId("dataflow-group-node");
      const input = chip.querySelector('[data-group-proxy][data-socket-side="input"]');
      const output = chip.querySelector('[data-group-proxy][data-socket-side="output"]');
      expect(input).toHaveAttribute("data-node-id", "n1");
      expect(input).toHaveAttribute("data-socket-key", "num1");
      expect(output).toHaveAttribute("data-node-id", "n2");
      expect(output).toHaveAttribute("data-socket-key", "value");
    });

    it("is labelled for assistive tech", () => {
      const { getByTestId } = renderOverlay({ collapsed: true, iface });
      expect(getByTestId("dataflow-group-node")).toHaveAttribute("aria-label", "Collapsed group: My Group");
    });

    it("roves focus among the chip's interactives with the arrow keys", () => {
      const { getByTestId } = renderOverlay({ collapsed: true, iface });
      const chip = getByTestId("dataflow-group-node");
      const items = Array.from(chip.querySelectorAll<HTMLElement>(".dataflow-group-toggle,[data-socket-side]"));
      expect(items.length).toBe(3); // expand toggle + one input proxy + one output proxy

      items[0].focus();
      fireEvent.keyDown(items[0], { key: "ArrowRight" });
      expect(document.activeElement).toBe(items[1]);
      // Wraps around from the last item back to the first.
      items[items.length - 1].focus();
      fireEvent.keyDown(items[items.length - 1], { key: "ArrowRight" });
      expect(document.activeElement).toBe(items[0]);
      fireEvent.keyDown(items[0], { key: "End" });
      expect(document.activeElement).toBe(items[items.length - 1]);
    });

    it("expands via the toggle", () => {
      const { getByTestId, group } = renderOverlay({ collapsed: true, iface });
      fireEvent.click(within(getByTestId("dataflow-group-node")).getByTestId("dataflow-group-expand"));
      expect(group.collapsed).toBe(false);
    });
  });

  describe("boundary wires", () => {
    it("draws no wire for an external whose socket cannot be resolved", () => {
      // getSocketElement returns undefined for a far end with no visible anchor, and the effect
      // drops the wire rather than measuring a zero-size element and drawing it to the origin.
      const iface = {
        inputs: [{ nodeId: "n1", key: "num1", external: { connId: "c1", externalNodeId: "ext", externalKey: "o" } }],
        outputs: [],
      };
      const { container } = renderOverlay({ collapsed: true, iface });
      expect(container.querySelectorAll(".dataflow-group-wires path")).toHaveLength(0);
    });

    it("draws one wire per boundary connection", () => {
      const iface = {
        inputs: [{ nodeId: "n1", key: "num1", external: { connId: "c1", externalNodeId: "ext", externalKey: "o" } }],
        outputs: [{ nodeId: "n2", key: "value", externals: [{ connId: "c2", externalNodeId: "ext", externalKey: "i" }] }],
      };
      const { container } = renderOverlay({ collapsed: true, iface, resolvableExternals: ["ext"] });
      expect(container.querySelectorAll(".dataflow-group-wires path")).toHaveLength(2);
    });

    it("draws a connection between two collapsed groups only once", () => {
      // Both groups expose the same connection — one as an input, one as an output — so without
      // deduping by connection id the same route would be stroked twice.
      const iface = {
        inputs: [{ nodeId: "n1", key: "num1", external: { connId: "shared", externalNodeId: "ext", externalKey: "o" } }],
        outputs: [{ nodeId: "n2", key: "value", externals: [{ connId: "shared", externalNodeId: "ext", externalKey: "i" }] }],
      };
      const { container } = renderOverlay({ collapsed: true, iface, resolvableExternals: ["ext"] });
      expect(container.querySelectorAll(".dataflow-group-wires path")).toHaveLength(1);
    });
  });
});
