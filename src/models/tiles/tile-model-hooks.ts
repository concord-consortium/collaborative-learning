import { ISerializedActionCall } from "mobx-state-tree";
import { ITileMetadataModel } from "./tile-metadata";

export interface ITileContentAPIActions {
  /**
   * This is called after the wrapper around the content model is created. This wrapper is
   * a TileModel. This should only be called once.
   *
   * @param metadata an instance of this model's metadata it might be shared by
   * multiple instances of the model if the document of this model is open in
   * more than one place.
   */
  doPostCreate(metadata: ITileMetadataModel): void;

  /**
   * This is called for any action that is called on the wrapper (TileModel) or one of
   * its children. It can be used for logging or internal monitoring of action calls.
   */
  onTileAction(call: ISerializedActionCall): void;

  /**
   * This is called before the tile is removed from the row of the document.
   * Immediately after the tile is removed from the row it is also removed from
   * the tileMap which is the actual container of the tile.
   */
  willRemoveFromDocument(): void;

  /**
   * Sets the title if it is stored in the tile's content.
   * This is currently used for using the DataSet name as a title, by the Table and DataCard tiles.
   * @param title
   */
  setContentTitle(title: string): void;

}

// This is a way to work with MST action syntax
// The input argument has to match the api and the result
// is a literal object type which is compatible with the ModelActions
// type that is required by MST.

/**
 * A TypeScript helper method for adding hooks to a content model. It should be
 * used like:
 * ```
 * .actions(self => tileContentAPIActions({
 *   // add your hook functions here
 * }))
 * ```
 * @param clientHooks the hook functions
 * @returns the hook functions in a literal object format that is compatible
 * with the ModelActions type of MST
 */
export function tileContentAPIActions(clientHooks: Partial<ITileContentAPIActions>) {
  const hooks: ITileContentAPIActions = {
    doPostCreate(metadata: ITileMetadataModel) {
      // no-op
    },
    onTileAction(call: ISerializedActionCall) {
      // no-op
    },
    willRemoveFromDocument() {
      // no-op
    },
    setContentTitle(title: string) {
      // no-op
    },
    ...clientHooks
  };
  return {...hooks};
}

export interface ITileContentAPIViews {
  /**
   * If the TileModel has no stored title,
   * the TileModel will call contentTitle on the content model.
   * This can be used so a content model can provide a computed title.
   */
  get contentTitle(): string | undefined,
}

/**
 * A TypeScript helper method for adding standard views to a content model. It should be
 * used like:
 * ```
 * .views(self => tileContentAPIViews({
 *   // add your hook functions here
 * }))
 * ```
 * @param clientViews the views your tile is implementing
 * @returns the views in a literal object format that is compatible
 * with the ModelViews type of MST
 */
export function tileContentAPIViews(clientViews: Partial<ITileContentAPIViews>) {
  const defaultHooks: ITileContentAPIViews = {
    get contentTitle() {
      return undefined;
    },
  };

  // Using Object.defineProperties is needed so we can correctly copy the getters from the clientViews
  // into the new object
  return Object.defineProperties(defaultHooks, Object.getOwnPropertyDescriptors(clientViews));
}
