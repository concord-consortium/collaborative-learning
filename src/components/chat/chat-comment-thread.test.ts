import { makeChatThreads } from "./chat-comment-thread";
import { DocumentContentModel } from "../../models/document/document-content";
import { createSingleTileContent } from "../../utilities/test-utils";
import { WithId } from "src/hooks/firestore-hooks";
import { CommentDocument } from "src/lib/firestore-schema";


const makeFakeComment = (id: string, tileId: string | null) => {
    const comment: WithId<CommentDocument> = {
        id,
        tileId,
        uid: "u1",
        createdAt: new Date(),
        name: "a name",
        content: "some comment text"
    } as WithId<CommentDocument>;
    return comment;
};


describe("Chat comment thread", () => {
    it("Test for no comments", () => {
        const threads = makeChatThreads([], undefined);
        expect(threads).toEqual([]);
    });

    it("Test for no document", () => {
        const fakeComment = makeFakeComment("c1", null);
        const threads = makeChatThreads([fakeComment], undefined);
        const fakeChatThread = {
            title: null,
            tileId: null,
            tileType: null,
            comments: [fakeComment],
            isDeletedTile: false,
        };
        expect(threads.length).toEqual(1);
        expect(threads[0]).toEqual(fakeChatThread);
    });

    it("Test all doc comments", () => {
        const content = DocumentContentModel.create(createSingleTileContent({
            id: "t1",
            type: "Text",
            title: "test title",
          }));

        const c1 = makeFakeComment("c1", null);
        const c2 = makeFakeComment("c2", null);
        const comments = [c1, c2];
        const threads = makeChatThreads(comments, content);
        expect(threads.length).toEqual(1);
        expect(threads[0].comments).toEqual(comments);
        expect(threads[0].tileId).toBe(null);
        expect(threads[0].tileType).toBe(null);
    });

    it("Test all tile comments", () => {
        const content = DocumentContentModel.create(createSingleTileContent({
            type: "Text",
            title: "test title",
          }));
        const c1 = makeFakeComment("c1", "tile1");
        const c2 = makeFakeComment("c2", "tile1");
        const comments = [c1, c2];
        const threads = makeChatThreads(comments, content);
        expect(threads.length).toEqual(1);
        expect(threads[0].comments).toEqual(comments);
        expect(threads[0].tileId).toEqual("tile1");
        expect(threads[0].tileType).toBeDefined();
    });

    it("Document and Tile comments", () => {
        const content = DocumentContentModel.create(createSingleTileContent({
            type: "Text",
            title: "test title",
          }));

        const docComments = [makeFakeComment("c1", null), makeFakeComment("c2", null)];
        const tileComments = [makeFakeComment("c3", "tile1"), makeFakeComment("c2", "tile1")];
        const threads = makeChatThreads(docComments.concat(tileComments), content);
        expect(threads.length).toEqual(2);
        expect(threads[0].comments).toEqual(docComments);
        expect(threads[0].tileId).toBe(null);
        expect(threads[0].tileType).toBe(null);
        expect(threads[1].comments).toEqual(tileComments);
        expect(threads[1].tileId).toEqual("tile1");
        expect(threads[1].tileType).toBeDefined();
    });

    it("Test comments on deleted tiles", () => {
        const content = DocumentContentModel.create(createSingleTileContent({
            type: "Text",
            title: "test title",
          }));
        const c1 = makeFakeComment("c1", "tile1");
        const c2 = makeFakeComment("c2", "tile2"); // tile2 does not exist in content, this fakes a deleted tile
        const comments = [c1, c2];
        const threads = makeChatThreads(comments, content);
        expect(threads.length).toEqual(2);

        expect(threads[0].comments).toEqual([c1]);
        expect(threads[0].tileId).toEqual("tile1");
        expect(threads[0].tileType).toBeDefined();
        expect(threads[0].isDeletedTile).toEqual(false);

        expect(threads[1].comments).toEqual([c2]);
        expect(threads[1].tileId).toEqual("tile2");
        expect(threads[1].tileType).toBeDefined();
        expect(threads[1].isDeletedTile).toEqual(true);
    });
});
