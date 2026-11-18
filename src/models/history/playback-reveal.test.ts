import { Instance } from "mobx-state-tree";
import { createDocumentModel } from "../document/document";
import { DocumentContentModelType } from "../document/document-content";
import { ProblemDocument } from "../document/document-types";
import { QuestionContentModel } from "../tiles/question/question-content";
import { kQuestionTileType } from "../tiles/question/question-types";
import { TableContentModelType } from "../tiles/table/table-content";
import { defaultTextContent, TextContentModelType } from "../tiles/text/text-content";
import { registerTileTypes } from "../../register-tile-types";
import { HistoryEntry, HistoryEntrySnapshot, HistoryEntryType } from "./history";
import { getChangedTileId, getPlaybackRevealTileId } from "./playback-reveal";
import { TreeManager } from "./tree-manager";
import { expectEntryToBeComplete } from "./undo-store-test-utils";

jest.mock("firebase/app", () => ({
  functions: () => ({ httpsCallable: () => jest.fn() })
}));

registerTileTypes(["Text", "Table", "Question"]);

const kTreeId = "doc";

/**
 * Records six entries on a document with a Text tile and a Table tile, and leaves the document at
 * the end of them:
 * 0 add Text, 1 add Table, 2 set the Text tile's text, 3 add a case to the Table's data set,
 * 4 move the Table's row above the Text row, 5 delete the Text tile.
 */
async function recordHistory() {
  const document = createDocumentModel({ uid: "1", type: ProblemDocument, key: kTreeId, content: {} as any });
  const manager = document.treeManagerAPI as Instance<typeof TreeManager>;
  document.treeMonitor!.enableMonitoring();
  const content = document.content!;

  const textId = content.addTile("Text")!.tileId;
  await expectEntryToBeComplete(manager, 1);
  const tableId = content.addTile("Table")!.tileId;
  await expectEntryToBeComplete(manager, 2);
  (content.getTile(textId)!.content as TextContentModelType).setText("changed");
  await expectEntryToBeComplete(manager, 3);
  const table = content.getTile(tableId)!.content as TableContentModelType;
  const attributeId = table.dataSet.attributes[0].id;
  table.dataSet.addCanonicalCasesWithIDs([{ __id__: "case1", [attributeId]: 1 }]);
  await expectEntryToBeComplete(manager, 4);
  const textRowId = content.findRowIdContainingTile(textId)!;
  content.userMoveTiles(content.getDragTileItems([tableId]),
    { rowInsertIndex: 0, rowDropId: textRowId, rowDropLocation: "top" });
  await expectEntryToBeComplete(manager, 5);
  content.userDeleteTile(textId);
  await expectEntryToBeComplete(manager, 6);
  manager.setNumHistoryEntriesApplied(6);

  const history = manager.document.history;
  const moveAndReveal = async (from: number, to: number) => {
    await manager.goToHistoryEntryPosition(from);
    await manager.goToHistoryEntryPosition(to);
    return getPlaybackRevealTileId({ history, treeId: kTreeId, from, to, content });
  };
  return { manager, content, history, textId, tableId, moveAndReveal };
}

describe("getPlaybackRevealTileId over recorded history", () => {
  it.each([
    [6, 5, "text"],
    [5, 4, "table"],
    [4, 3, "table"],
    [3, 2, "text"],
    [2, 1, undefined],
    [1, 0, undefined],
    [0, 3, "text"],
    [3, 4, "table"],
    [4, 6, undefined],
    [6, 1, undefined]
  ])("names the tile a move from %i to %i changed", async (from, to, expected) => {
    const { moveAndReveal, textId, tableId } = await recordHistory();
    const expectedId = expected === "text" ? textId : expected === "table" ? tableId : undefined;
    expect(await moveAndReveal(from, to)).toBe(expectedId);
  });
});

describe("getPlaybackRevealTileId with background entries", () => {
  let content: DocumentContentModelType;
  let textId: string;
  let tableId: string;

  beforeEach(async () => {
    const recorded = await recordHistory();
    await recorded.manager.goToHistoryEntryPosition(4);
    ({ content, textId, tableId } = recorded);
  });

  let entryCount = 0;
  const entryOn = (tileId: string, extra: Partial<HistoryEntrySnapshot> = {}) => HistoryEntry.create({
    id: `entry-${++entryCount}`, tree: kTreeId, model: "Test", action: "/userAction", undoable: true,
    state: "complete",
    records: [{
      tree: kTreeId, action: "/userAction",
      patches: [{ op: "replace", path: `/content/tileMap/${tileId}/content/x`, value: 1 }],
      inversePatches: [{ op: "replace", path: `/content/tileMap/${tileId}/content/x`, value: 0 }]
    }],
    ...extra
  });
  const reveal = (entries: HistoryEntryType[], from: number, to: number) =>
    getPlaybackRevealTileId({ history: entries, treeId: kTreeId, from, to, content });

  it("passes over a load entry at the end of a move", () => {
    const entries = [entryOn(tableId), entryOn(textId, { isLoadEntry: true, background: true })];
    expect(reveal(entries, 0, 2)).toBe(tableId);
  });

  it("does not reveal for a move across only a load entry", () => {
    const entries = [entryOn(tableId), entryOn(textId, { isLoadEntry: true, background: true })];
    expect(reveal(entries, 1, 2)).toBeUndefined();
  });

  it("names the user's change, not the program ticks around it", () => {
    const tick = () => entryOn(tableId, { background: true });
    const entries = [entryOn(textId), tick(), tick(), entryOn(textId), tick()];
    expect(reveal(entries, 4, 1)).toBe(textId);
    expect(reveal(entries, 1, 4)).toBe(textId);
    expect(reveal(entries, 0, 5)).toBe(textId);
    expect(reveal(entries, 4, 5)).toBeUndefined();
    expect(reveal(entries, 5, 4)).toBeUndefined();
  });

  it("passes over an unflagged tick recorded before the background flag existed", () => {
    const legacyTick = entryOn(textId, { action: "/content/tileMap/df/content/tickAndProcess" });
    expect(legacyTick.background).toBeUndefined();
    const entries = [legacyTick, entryOn(tableId)];
    expect(reveal(entries, 2, 0)).toBe(tableId);
  });
});

describe("getChangedTileId", () => {
  let content: DocumentContentModelType;
  let textId: string;
  let tableId: string;

  beforeEach(async () => {
    const recorded = await recordHistory();
    await recorded.manager.goToHistoryEntryPosition(4);
    ({ content, textId, tableId } = recorded);
  });

  it("does not count the hash every linked tile gets when its shared model changes", () => {
    expect(getChangedTileId([
      { op: "replace", path: `/content/tileMap/${tableId}/updatedHash`, value: "h" },
      { op: "replace", path: `/content/tileMap/${textId}/content/text`, value: "t" }
    ], content)).toBe(textId);
  });

  it("prefers a tile the patches changed over a tile linked to a shared model they changed", () => {
    const sharedModelId = content.sharedModelMap.keys().next().value!;
    expect(content.sharedModelMap.get(sharedModelId)!.tiles.map(tile => tile.id)).toEqual([tableId]);
    expect(getChangedTileId([
      { op: "replace", path: `/content/sharedModelMap/${sharedModelId}/sharedModel/name`, value: "n" },
      { op: "replace", path: `/content/tileMap/${textId}/content/text`, value: "t" }
    ], content)).toBe(textId);
  });
});

describe("getPlaybackRevealTileId inside a Question", () => {
  // A Question holding Text tiles A and B in rows of their own, with one entry that moves B's row
  // above A's.
  async function recordMoveInQuestion() {
    const document = createDocumentModel({ uid: "1", type: ProblemDocument, key: kTreeId, content: {} as any });
    const manager = document.treeManagerAPI as Instance<typeof TreeManager>;
    const content = document.content!;
    const question = QuestionContentModel.create({ type: kQuestionTileType, version: 2 });
    const questionId = content.addTileContentInNewRow(question).tileId;
    const textA = content.addTileContentInNewRow(defaultTextContent(), { rowList: question }).tileId;
    const textB = content.addTileContentInNewRow(defaultTextContent(), { rowList: question }).tileId;
    document.treeMonitor!.enableMonitoring();
    content.userMoveTiles(content.getDragTileItems([textB]),
      { rowInsertIndex: 0, rowDropId: content.findRowIdContainingTile(textA)!, rowDropLocation: "top" });
    await expectEntryToBeComplete(manager, 1);
    manager.setNumHistoryEntriesApplied(1);
    const history = manager.document.history;
    expect(history.at(0)!.records[0].patches.every(({ path }) =>
      path.startsWith(`/content/tileMap/${questionId}/content/row`))).toBe(true);
    const moveAndReveal = async (to: number) => {
      const from = manager.numHistoryEventsApplied!;
      await manager.goToHistoryEntryPosition(to);
      return getPlaybackRevealTileId({ history, treeId: kTreeId, from, to, content });
    };
    return { content, questionId, textB, moveAndReveal };
  }

  it("names the tile a row move inside the Question moved, not the Question", async () => {
    const { moveAndReveal, textB } = await recordMoveInQuestion();
    expect(await moveAndReveal(0)).toBe(textB);
    expect(await moveAndReveal(1)).toBe(textB);
  });

  it("names the Question when none of the tiles in the rows it changed is left", async () => {
    const { content, questionId } = await recordMoveInQuestion();
    expect(getChangedTileId([
      { op: "remove", path: `/content/tileMap/${questionId}/content/rowOrder/0` },
      { op: "remove", path: `/content/tileMap/${questionId}/content/rowMap/gone` }
    ], content)).toBe(questionId);
  });
});
