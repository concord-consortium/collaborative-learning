import { buildContextPacket, kMaxPacketBytes, kMaxSharedModels, kMaxTiles } from "./packet";

const kCommit = "a".repeat(40);

const docOpts = { documentId: "doc-abc", revision: "r22" };

const envelopeOpts = {
  traceId: "trace-1", requestId: "req-1", turn: 1, catalogCommit: kCommit,
  protection: { classes: ["protected_threshold_value" as const], patternRefs: ["pat-1"] },
};

const program = {
  id: "dataflow@1",
  nodes: {
    "n-sensor": {
      id: "n-sensor", name: "Sensor", x: 31.26, y: 93.92,
      data: {
        type: "Sensor", plot: false, orderedDisplayName: "Sensor 1",
        tickEntries: { t1: { nodeValue: "37" }, t2: { nodeValue: "39" } },
        sensorType: "emg-reading",
      },
    },
    "n-out": {
      id: "n-out", name: "Demo Output", x: 674.09, y: 84.55,
      data: {
        type: "Demo Output", plot: false, orderedDisplayName: "Demo Device 1",
        tickEntries: { t1: { nodeValue: "0" }, t2: { nodeValue: "1" } },
        outputType: "Grabber",
      },
    },
  },
  connections: {
    c1: { id: "c1", source: "n-sensor", sourceOutput: "value",
          target: "n-out", targetInput: "nodeValue" },
  },
  recentTicks: ["t1", "t2"],
};

// A document in the shape CLUE holds one: rows in order, tiles keyed by id, shared models to the
// side. The first row is a section header, which carries no tiles.
function aDocument() {
  return {
    rowOrder: ["row-h", "row-1", "row-2"],
    rowMap: {
      "row-h": { id: "row-h", isSectionHeader: true, sectionId: "problem", tiles: [] },
      "row-1": { id: "row-1", tiles: [{ tileId: "tile-tx-1" }, { tileId: "tile-ph-1" }] },
      "row-2": { id: "row-2", tiles: [{ tileId: "tile-df-1" }, { tileId: "tile-tbl-1" }] },
    },
    tileMap: {
      "tile-tx-1": { id: "tile-tx-1", title: "Notes", content: {
        type: "Text", format: "html", text: ["<p>Flex to close it.</p>"] } },
      "tile-ph-1": { id: "tile-ph-1", content: { type: "Placeholder", sectionId: "problem" } },
      "tile-df-1": { id: "tile-df-1", title: "Gripper Program", content: {
        type: "Dataflow", program } },
      "tile-tbl-1": { id: "tile-tbl-1", content: { type: "Table", columnWidths: { ATTRx: 120 } } },
    },
    sharedModelMap: {
      "sm-data": {
        sharedModel: {
          type: "SharedDataSet", id: "sm-data", providerId: "tile-df-1",
          dataSet: {
            id: "ds-1", name: "Program 1",
            attributes: [
              { id: "ATTRx", name: "time", units: "s", values: ["0", "1", "2", "3"] },
              { id: "ATTRy", name: "emg", units: "mV", values: ["37", "39", "250", "248"] },
            ],
            cases: [{ __id__: "c1" }, { __id__: "c2" }, { __id__: "c3" }, { __id__: "c4" }],
          },
        },
        tiles: ["tile-df-1", "tile-tbl-1"],
      },
    },
  };
}

describe("buildContextPacket", () => {
  it("names the schema it conforms to and carries the envelope", () => {
    const { packet } = buildContextPacket({ content: aDocument(), ...docOpts, envelope: envelopeOpts });
    expect(packet.schema_version).toBe("clue.context_packet.v2");
    expect(packet.envelope.trace.trace_id).toBe("trace-1");
    expect(packet.envelope.catalog_version.commit).toBe(kCommit);
  });

  // Reading order is the only order a diagnostic can reason about — "the tile above the program"
  // is a thing a student says. normalize() walks rowOrder, so the packet inherits it.
  it("carries the tiles in document order", () => {
    const { packet } = buildContextPacket({ content: aDocument(), ...docOpts, envelope: envelopeOpts });
    expect(packet.workspace_state!.tiles.map(t => t.tile_id))
      .toEqual(["tile-tx-1", "tile-df-1", "tile-tbl-1"]);
  });

  it("routes a Dataflow tile to the dataflow projection and the rest to theirs", () => {
    const { packet } = buildContextPacket({ content: aDocument(), ...docOpts, envelope: envelopeOpts });
    const byId = Object.fromEntries(packet.workspace_state!.tiles.map(t => [t.tile_id, t]));
    expect(byId["tile-df-1"].type).toBe("Dataflow");
    expect((byId["tile-df-1"].content as any).nodes).toHaveLength(2);
    expect((byId["tile-df-1"].content as any).rendering).toEqual(expect.any(String));
    expect(byId["tile-tx-1"].type).toBe("Text");
    expect(byId["tile-tbl-1"].type).toBe("Table");
  });

  it("tells each tile which shared models it references", () => {
    const { packet } = buildContextPacket({ content: aDocument(), ...docOpts, envelope: envelopeOpts });
    const byId = Object.fromEntries(packet.workspace_state!.tiles.map(t => [t.tile_id, t]));
    expect(byId["tile-tbl-1"].shared_model_ids).toEqual(["sm-data"]);
    expect(byId["tile-tx-1"].shared_model_ids).toBeUndefined();
    expect(packet.workspace_state!.shared_models!.map(m => m.model_id)).toEqual(["sm-data"]);
  });

  // A tick record per node per run is most of a raw Dataflow tile and near-identical tick to tick.
  // Only the latest value is evidence, and it describes the run rather than the program.
  it("puts the latest run values in run_state rather than on the nodes", () => {
    const { packet } = buildContextPacket({ content: aDocument(), ...docOpts, envelope: envelopeOpts });
    expect(packet.run_state!.values).toEqual([
      { node_id: "n-sensor", value: "39" }, { node_id: "n-out", value: "1" },
    ]);
    expect(JSON.stringify(packet.workspace_state)).not.toContain("tickEntries");
  });

  // Absent rather than empty: a document with no program has no run to report, which is not the
  // same claim as a program that ran and produced nothing.
  it("omits run_state entirely for a document with no Dataflow tile", () => {
    const doc = aDocument();
    delete (doc.tileMap as any)["tile-df-1"];
    doc.rowMap["row-2"].tiles = [{ tileId: "tile-tbl-1" }];
    const { packet } = buildContextPacket({ content: doc, ...docOpts, envelope: envelopeOpts });
    expect(packet.run_state).toBeUndefined();
  });

  it("reports the packet's size on the wire and whether it fits", () => {
    const { bytes, overLimit } = buildContextPacket({
      content: aDocument(), ...docOpts, envelope: envelopeOpts });
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThan(kMaxPacketBytes);
    expect(overLimit).toBe(false);
  });

  // Anything the projections dropped has to be visible here, or the packet reads as a complete
  // account of a workspace it only partly describes.
  //
  // A kind and a count, and deliberately no id: the schema's own note is that these are
  // "declarations of absence, never addressable and never citable as evidence", and that the
  // absence of a ref grammar for them IS the enforcement. Naming the model we truncated would
  // hand the diagnostic something to cite.
  it("declares dropped dataset rows as an absence with nothing to cite", () => {
    const { packet } = buildContextPacket({
      content: aDocument(), ...docOpts, envelope: envelopeOpts, caseSampleSize: 2 });
    expect(packet.workspace_state!.omitted).toEqual([{ kind: "dataset_cases", count: 2 }]);
    expect(JSON.stringify(packet.workspace_state!.omitted)).not.toContain("sm-data");
    // The count in the shared model itself stays truthful, which is what makes this visible
    // rather than merely declared.
    expect((packet.workspace_state!.shared_models![0].content as any).case_count).toBe(4);
  });

  // Absent rather than an empty array, so an untruncated packet makes no claim either way.
  it("declares no omissions when nothing was dropped", () => {
    const { packet } = buildContextPacket({
      content: aDocument(), ...docOpts, envelope: envelopeOpts });
    expect(packet.workspace_state!.omitted).toBeUndefined();
  });

  // workspace_state requires both, and a packet missing either is rejected outright.
  it("identifies the document and the revision the packet describes", () => {
    const { packet } = buildContextPacket({
      content: aDocument(), ...docOpts, envelope: envelopeOpts });
    expect(packet.workspace_state!.document_id).toBe("doc-abc");
    expect(packet.workspace_state!.revision).toBe("r22");
  });

  // The schema caps tiles at 100 and shared models at 20. Going over does not make a big packet,
  // it makes an invalid one — so the cap is enforced here and the shortfall declared, which is
  // exactly the mechanism omitted[] exists for.
  it("caps the tiles it sends and declares how many it dropped", () => {
    const doc: any = aDocument();
    for (let i = 0; i < kMaxTiles + 5; i++) {
      doc.tileMap[`t${i}`] = { id: `t${i}`, content: { type: "Text", format: "html", text: "x" } };
      doc.rowMap["row-1"].tiles.push({ tileId: `t${i}` });
    }
    const { packet } = buildContextPacket({ content: doc, ...docOpts, envelope: envelopeOpts });
    expect(packet.workspace_state!.tiles).toHaveLength(kMaxTiles);
    expect(packet.workspace_state!.omitted).toContainEqual({ kind: "tiles", count: 8 });
  });

  it("caps the shared models it sends and declares how many it dropped", () => {
    const doc: any = aDocument();
    for (let i = 0; i < kMaxSharedModels; i++) {
      doc.sharedModelMap[`sm${i}`] = {
        sharedModel: { type: "SharedVariables", id: `sm${i}`, variables: [] }, tiles: [],
      };
    }
    const { packet } = buildContextPacket({ content: doc, ...docOpts, envelope: envelopeOpts });
    expect(packet.workspace_state!.shared_models).toHaveLength(kMaxSharedModels);
    expect(packet.workspace_state!.omitted).toContainEqual({ kind: "shared_models", count: 1 });
  });

  // A shared_model_ids entry naming a model the packet does not carry is a dangling reference,
  // and an id that resolves to nothing is the fail-open case: the reader cannot tell a model we
  // dropped from one it failed to look up.
  it("never points a tile at a shared model the packet did not carry", () => {
    const doc: any = aDocument();
    for (let i = 0; i < kMaxSharedModels; i++) {
      doc.sharedModelMap[`sm${i}`] = {
        sharedModel: { type: "SharedVariables", id: `sm${i}`, variables: [] },
        tiles: ["tile-tx-1"],
      };
    }
    const { packet } = buildContextPacket({ content: doc, ...docOpts, envelope: envelopeOpts });
    const carried = new Set(packet.workspace_state!.shared_models!.map(m => m.model_id));
    const textTile = packet.workspace_state!.tiles.find(t => t.tile_id === "tile-tx-1")!;
    // Assert the count first: a loop over an empty list passes without testing anything, and the
    // filter under test is exactly what could empty it. The tile references kMaxSharedModels
    // models, but the document's own shared model takes one of the carried slots, so exactly one
    // referenced model falls outside the cap and must be filtered out of this list.
    expect(textTile.shared_model_ids).toHaveLength(kMaxSharedModels - 1);
    for (const tile of packet.workspace_state!.tiles) {
      for (const id of tile.shared_model_ids ?? []) expect(carried.has(id)).toBe(true);
    }
  });

  it("caps the run values it sends and declares how many it dropped", () => {
    const doc: any = aDocument();
    const nodes: any = {};
    for (let i = 0; i < 105; i++) {
      nodes[`n${i}`] = { id: `n${i}`, data: {
        type: "Sensor", orderedDisplayName: `Sensor ${i}`, tickEntries: { t2: { nodeValue: i } },
      } };
    }
    doc.tileMap["tile-df-1"].content.program = { id: "p", nodes, connections: {},
                                                 recentTicks: ["t2"] };
    const { packet } = buildContextPacket({ content: doc, ...docOpts, envelope: envelopeOpts });
    expect(packet.run_state!.values).toHaveLength(100);
    expect(packet.workspace_state!.omitted).toContainEqual({ kind: "run_values", count: 5 });
  });

  // A packet over the cap is still returned: the caller decides whether to send it, and silently
  // shrinking it would hide the very thing worth knowing during the spike.
  it("flags a packet that exceeds the cap without mangling it", () => {
    const doc = aDocument();
    const values = Array.from({ length: 20000 }, (_, i) => `${i}`);
    (doc.sharedModelMap["sm-data"].sharedModel.dataSet as any).attributes[0].values = values;
    (doc.sharedModelMap["sm-data"].sharedModel.dataSet as any).cases =
      values.map((_, i) => ({ __id__: `c${i}` }));
    const { packet, bytes, overLimit } = buildContextPacket({
      content: doc, ...docOpts, envelope: envelopeOpts, caseSampleSize: 20000 });
    expect(overLimit).toBe(true);
    expect(bytes).toBeGreaterThan(kMaxPacketBytes);
    expect(packet.workspace_state!.tiles).toHaveLength(3);
  });
});

// A run value carries only node_id — no tile_id — so it can only be understood by finding the node
// in a tile the packet carries. Collecting values before the tile cap leaves values behind from
// tiles that were dropped: evidence in the packet that resolves to nothing, which is the same
// dangling reference shared_model_ids is filtered to prevent.
describe("buildContextPacket run values follow their tiles", () => {
  function docWithDataflowAfterCap() {
    const doc: any = aDocument();
    // push the Dataflow tile past the cap with filler tiles ahead of it
    doc.rowMap["row-1"].tiles = [];
    for (let i = 0; i < kMaxTiles + 2; i++) {
      doc.tileMap[`f${i}`] = { id: `f${i}`, content: { type: "Text", format: "html", text: "x" } };
      doc.rowMap["row-1"].tiles.push({ tileId: `f${i}` });
    }
    return doc;
  }

  it("drops the run values of a tile the cap dropped", () => {
    const { packet } = buildContextPacket({
      content: docWithDataflowAfterCap(), ...docOpts, envelope: envelopeOpts });
    const carried = new Set(packet.workspace_state!.tiles.map(t => t.tile_id));
    expect(carried.has("tile-df-1")).toBe(false);
    // its nodes were n-sensor and n-out; neither may appear as evidence
    const nodeIds = (packet.run_state?.values ?? []).map(v => v.node_id);
    expect(nodeIds).not.toContain("n-sensor");
    expect(nodeIds).not.toContain("n-out");
  });

  it("still carries run values for a Dataflow tile that survived the cap", () => {
    const { packet } = buildContextPacket({
      content: aDocument(), ...docOpts, envelope: envelopeOpts });
    expect(packet.run_state!.values.map(v => v.node_id)).toEqual(["n-sensor", "n-out"]);
  });
});
