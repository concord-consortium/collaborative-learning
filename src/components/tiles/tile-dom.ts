/**
 * The DOM contract for a rendered tile.
 *
 * `TileComponent` marks every tile it renders with this class and id attribute, and several
 * features find tiles by querying for them: keyboard navigation between siblings, drag/pick-up
 * targeting, and visibility logging. A model-based alternative was tried for keyboard nav and gave
 * the wrong order in practice, so the DOM remains the source of truth for "which tiles are on
 * screen, and where".
 *
 * That makes the class name load-bearing rather than cosmetic. Both sides of the contract are
 * defined here so a rename reaches all of them at once, and `tile-component.test.tsx` asserts that
 * what `TileComponent` renders is still what these queries look for.
 */

export const kTileClass = "tool-tile";
export const kTileIdAttr = "data-tool-id";

/** Matches any rendered tile carrying an id. */
export const kTileSelector = `.${kTileClass}[${kTileIdAttr}]`;

/** Matches the one rendered tile with this id. */
export function tileSelector(tileId: string) {
  return `.${kTileClass}[${kTileIdAttr}="${tileId}"]`;
}

/** The attributes `TileComponent` puts on a tile's element, for the query helpers to find. */
export function tileDomAttributes(tileId: string) {
  return { [kTileIdAttr]: tileId };
}

/**
 * Every rendered tile under `root`, in document order. Tiles nested inside a container tile are
 * included along with the container itself; use `getContainingTileNode` to tell them apart.
 */
export function getTileNodes(root: ParentNode) {
  return Array.from(root.querySelectorAll<HTMLElement>(kTileSelector));
}

export function getTileNode(root: ParentNode, tileId: string) {
  return root.querySelector<HTMLElement>(tileSelector(tileId)) ?? undefined;
}

export function getTileIdFromNode(node: HTMLElement) {
  return node.dataset.toolId;
}

/** The container tile's element, for a tile rendered inside one; undefined for a top-level tile. */
export function getContainingTileNode(node: HTMLElement) {
  return node.parentElement?.closest<HTMLElement>(kTileSelector) ?? undefined;
}
