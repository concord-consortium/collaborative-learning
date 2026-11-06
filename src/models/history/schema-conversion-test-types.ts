import { Instance, types } from "mobx-state-tree";
import { ITileProps } from "src/components/tiles/tile-component";
import { SharedModel } from "../shared/shared-model";
import { registerSharedModelInfo } from "../shared/shared-model-registry";
import { ISchemaVersionInfo } from "../tiles/schema-version-info";
import { registerTileComponentInfo } from "../tiles/tile-component-info";
import { registerTileContentInfo } from "../tiles/tile-content-info";
import { TileContentModel } from "../tiles/tile-content";
import { uniqueId } from "../../utilities/js-utils";

// Test-only tile and shared model types with a version 1 and a version 2 format. Importing this
// file registers them.

export const kVersionedTestTileType = "VersionedTestTile";
export const kVersionedTestSharedModelType = "VersionedTestSharedModel";

const kCurrentVersion = "2";

// v1 content is `{ type, text, items: [{ value, deleted }] }`.
// v2 content is `{ type, version: "2", label, items: [{ id, value }] }`, without the deleted items.
// Any other version is declined, like a tile saved by a newer release.
function convertSnapshot(tile: any) {
  const content = tile?.content;
  if (!content) return tile;
  const version = content.version ?? "1";
  if (version === kCurrentVersion) return tile;
  if (version !== "1") return undefined;
  if (content.text === "THROW") throw new Error("cannot convert");
  const { text, items, ...others } = content;
  return {
    ...tile,
    content: {
      ...others,
      version: kCurrentVersion,
      label: text,
      items: (items ?? []).filter((item: any) => !item.deleted)
        .map((item: any) => ({ id: uniqueId(), value: item.value }))
    }
  };
}

export const versionedTestTileSchema: ISchemaVersionInfo = {
  currentVersion: kCurrentVersion,
  getVersion: tile => tile.content.version ?? "1",
  convertSnapshot
};

const VersionedTestItem = types.model("VersionedTestItem", {
  id: types.identifier,
  value: types.string
});

export const VersionedTestTile = TileContentModel
  .named("VersionedTestTile")
  .props({
    type: kVersionedTestTileType,
    version: kCurrentVersion,
    label: types.maybe(types.string),
    items: types.array(VersionedTestItem)
  })
  .actions(self => ({
    setLabel(label: string) {
      self.label = label;
    }
  }));
export interface VersionedTestTileType extends Instance<typeof VersionedTestTile> {}

const VersionedTestTileComponent: React.FC<ITileProps> = () => {
  throw new Error("Component not implemented.");
};

registerTileContentInfo({
  type: kVersionedTestTileType,
  modelClass: VersionedTestTile,
  defaultContent() {
    return VersionedTestTile.create();
  },
  // The preprocessors call the module's converters, not the ones on the schemas, so a spy on a
  // schema's convertSnapshot counts only the calls made through the registration, not MST's.
  tileSnapshotPreProcessor: tile => convertSnapshot(tile) ?? tile,
  schemaVersion: versionedTestTileSchema
});
registerTileComponentInfo({
  type: kVersionedTestTileType,
  Component: VersionedTestTileComponent,
  tileEltClass: "versioned-test-tile"
});

// v1 is `{ id, type, val }`; v2 is `{ id, type, version: "2", value }`. Any other version is declined.
function convertSharedModelSnapshot(sharedModel: any) {
  if (!sharedModel) return sharedModel;
  const version = sharedModel.version ?? "1";
  if (version === kCurrentVersion) return sharedModel;
  if (version !== "1") return undefined;
  const { val, ...others } = sharedModel;
  return { ...others, version: kCurrentVersion, value: val };
}

export const versionedTestSharedModelSchema: ISchemaVersionInfo = {
  currentVersion: kCurrentVersion,
  getVersion: sharedModel => sharedModel.version ?? "1",
  convertSnapshot: convertSharedModelSnapshot
};

export const VersionedTestSharedModel = SharedModel
  .named("VersionedTestSharedModel")
  .props({
    type: kVersionedTestSharedModelType,
    version: kCurrentVersion,
    value: types.maybe(types.string)
  })
  .preProcessSnapshot(sharedModel => convertSharedModelSnapshot(sharedModel) ?? sharedModel);

registerSharedModelInfo({
  type: kVersionedTestSharedModelType,
  modelClass: VersionedTestSharedModel,
  hasName: false,
  schemaVersion: versionedTestSharedModelSchema
});
