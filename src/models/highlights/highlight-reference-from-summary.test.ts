import fs from "fs";
import path from "path";
import { documentSummarizer } from "../../../shared/ai-summarizer/ai-summarizer";
import { DocumentContentModel } from "../document/document-content";
import { resolveHighlightReference } from "./highlight-reference";
import "../../register-tile-types";

// The worked example the highlight demo and its Cypress spec both use.
const demoPath = path.join(__dirname, "../../public/demo/docs/emg-highlight-demo.json");
const snapshot = JSON.parse(fs.readFileSync(demoPath, "utf8"));

describe("building a highlight reference from the workspace summary", () => {
  const summary = documentSummarizer(snapshot, {});

  it("names every tile's id", () => {
    const tileIds = Object.keys(snapshot.tileMap);
    expect(tileIds.length).toBeGreaterThan(0);
    for (const tileId of tileIds) {
      expect(summary).toContain(`This tile's id is \`${tileId}\`.`);
    }
  });

  it("names the Dataflow nodes' real ids", () => {
    const dataflowTile: any = Object.values(snapshot.tileMap)
      .find((tile: any) => tile.content?.type === "Dataflow");
    expect(dataflowTile).toBeDefined();
    const nodeIds = Object.keys(dataflowTile.content.program.nodes);
    expect(nodeIds.length).toBeGreaterThan(0);
    for (const nodeId of nodeIds) {
      expect(summary).toContain(`<tr><td>id</td><td>${nodeId}</td></tr>`);
    }
  });

  // The criterion that matters: the ids a model could read out of the summary are the document's
  // real ids. The containment checks below carry that guarantee — the resolver itself is
  // content-blind (see the last test), so its job here is narrower: proving a reference built
  // from these field names round-trips without drift.
  it("resolves a reference built only from ids found in the summary", () => {
    const dataflowTile: any = Object.values(snapshot.tileMap)
      .find((tile: any) => tile.content?.type === "Dataflow");
    const tileId = dataflowTile.id;
    const objectId = Object.keys(dataflowTile.content.program.nodes)[0];

    // Both ids must be readable from the summary, which is all the model ever sees.
    expect(summary).toContain(`This tile's id is \`${tileId}\`.`);
    expect(summary).toContain(`<tr><td>id</td><td>${objectId}</td></tr>`);

    const content = DocumentContentModel.create(snapshot);
    const targets = resolveHighlightReference({ kind: "object", tileId, objectId }, content);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toEqual({ tileId, objectId, objectType: undefined });
  });

  // NOTE the object resolver returns its input unchanged without checking that the object exists.
  // A reference to a deleted node therefore resolves to a target no tile will render, rather than
  // to an empty list — the ring simply does not appear. This test pins that actual contract rather
  // than the one the name "fails quiet" might suggest. Do not "fix" it to expect [].
  it("returns the reference unchanged for an id that is not in the document", () => {
    const content = DocumentContentModel.create(snapshot);
    const targets = resolveHighlightReference(
      { kind: "object", tileId: "nope", objectId: "alsoNope" }, content);
    expect(targets).toEqual([{ tileId: "nope", objectId: "alsoNope", objectType: undefined }]);
  });
});
