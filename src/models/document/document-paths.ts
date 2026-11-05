// Paths into a document's tree, as they appear in recorded patches and action calls. Code that
// recognizes a part of the document by its path uses these, so a change to the document's layout
// has one place to update.

export const kContentPath = "/content";
export const kTileMapPath = `${kContentPath}/tileMap`;
export const kSharedModelMapPath = `${kContentPath}/sharedModelMap`;

// The path segments contain no regex special characters, so they are used without escaping.

/** A tile or anything inside it. Group 1 is the tile id. */
export const kTileSubtreeRegex = new RegExp(`^${kTileMapPath}/([^/]+)(/|$)`);

/**
 * A tile or anything inside it, split in two. Group 1 is the tile id, and group 2 is the rest of
 * the path below the tile: empty for the tile itself, otherwise starting with `/`.
 */
export const kTileSubtreePartsRegex = new RegExp(`^${kTileMapPath}/([^/]+)(.*)$`);

/** A shared model map entry, exactly. Group 1 is the shared model id. */
export const kSharedModelEntryRegex = new RegExp(`^${kSharedModelMapPath}/([^/]+)$`);

/**
 * A shared model map entry or anything inside it, including the entry's `tiles` and `provider` as
 * well as its shared model. Group 1 is the shared model id.
 */
export const kSharedModelEntrySubtreeRegex = new RegExp(`^${kSharedModelMapPath}/([^/]+)(/|$)`);

/**
 * A shared model or anything inside it, but not the rest of its map entry. Group 1 is the shared
 * model id.
 */
export const kSharedModelSubtreeRegex = new RegExp(`^${kSharedModelMapPath}/([^/]+)/sharedModel(/|$)`);
