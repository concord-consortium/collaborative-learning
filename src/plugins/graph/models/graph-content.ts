import { reaction } from "mobx";
import { addDisposer, Instance, SnapshotIn, types } from "mobx-state-tree";
import { isSharedDataSet, SharedDataSet, SharedDataSetType } from "../../../models/shared/shared-data-set";
import { SelectionStoreModelType } from "../../../models/stores/selection";
import { ITableLinkProperties } from "../../../models/tiles/table-link-types";
import { TileMetadataModel } from "../../../models/tiles/tile-metadata";
import { tileModelHooks } from "../../../models/tiles/tile-model-hooks";
import { SharedModelType } from "../../../models/shared/shared-model";
import { ISharedModelManager } from "../../../models/shared/shared-model-manager";
import { getTileModel, setTileTitleFromContent } from "../../../models/tiles/tile-model";
import { IDataSet } from "../../../models/data/data-set";
import { GraphModel } from "./graph-model";
import { EmptyAxisModel } from "../axis/models/axis-model";

export interface IAxesParams {
  xName?: string;
  xAnnotation?: string;
  xMin: number;
  xMax: number;
  yName?: string;
  yAnnotation?: string;
  yMin: number;
  yMax: number;
}

// export function defaultGraphContent(options?: IDefaultContentOptions): GraphContentModelType {
//   const xRange = kGraphDefaultWidth / kGraphDefaultPixelsPerUnit;
//   const yRange = kGraphDefaultHeight / kGraphDefaultPixelsPerUnit;
//   return GraphContentModel.create({
//     board: {
//       xAxis: { name: "x", label: "x", min: kGraphDefaultXAxisMin, range: xRange },
//       yAxis: { name: "y", label: "y", min: kGraphDefaultYAxisMin, range: yRange }
//     }
//    });
// }

export interface IAxisLabels {
  x: string | undefined;
  y: string | undefined;
}

// track selection in metadata object so it is not saved to firebase but
// also is preserved across document/content reloads
export const GraphMetadataModel = TileMetadataModel
  .named("GraphMetadata")
  .props({
    disabled: types.array(types.string),
    selection: types.map(types.boolean)
  })
  .volatile(self => ({
    sharedSelection: undefined as any as SelectionStoreModelType
  }))
  .views(self => ({
    isSharedSelected(id: string) {
      const _id = id?.includes(":") ? id.split(":")[0] : id;
      let isSelected = false;
      self.sharedSelection?.sets.forEach(set => {
        // ignore labels with auto-assigned IDs associated with selected points
        if (set.isSelected(_id) && !id.endsWith("Label")) isSelected = true;
      });
      return isSelected;
    },
  }))
  .views(self => ({
    isDisabled(feature: string) {
      return self.disabled.indexOf(feature) >= 0;
    },
    isSelected(id: string) {
      return !!self.selection.get(id) || self.isSharedSelected(id);
    },
    hasSelection() {
      return Array.from(self.selection.values()).some(isSelected => isSelected);
    }
  }))
  .actions(self => ({
    setSharedSelection(sharedSelection: SelectionStoreModelType) {
      self.sharedSelection = sharedSelection;
    },
    setDisabledFeatures(disabled: string[]) {
      self.disabled.replace(disabled);
    },
    select(id: string) {
      self.selection.set(id, true);
    },
    deselect(id: string) {
      self.selection.set(id, false);
    },
    setSelection(id: string, select: boolean) {
      self.selection.set(id, select);
    }
  }));
export type GraphMetadataModelType = Instance<typeof GraphMetadataModel>;

export const GraphContentModel = GraphModel
  .named("GraphContent")
  .volatile(self => ({
    // metadata: undefined as any as GraphMetadataModelType,
    // Used to force linkedDataSets() to update. Hope to remove in the future.
    updateSharedModels: 0
  }))
  .actions(self => ({
    forceSharedModelUpdate() {
      self.updateSharedModels += 1;
    }
  }))
  .views(self => ({
    get data(): IDataSet | undefined {
      // MobX isn't properly monitoring getTileSharedModels, so we're manually forcing an update to this view here
      // eslint-disable-next-line no-unused-expressions
      self.updateSharedModels;
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const sharedModel = sharedModelManager?.getTileSharedModels(self).find(m => isSharedDataSet(m));
      return isSharedDataSet(sharedModel) ? sharedModel.dataSet : undefined;
    },
    get linkedDataSets(): SharedDataSetType[] {
      // MobX isn't properly monitoring getTileSharedModels, so we're manually forcing an update to this view here
      // eslint-disable-next-line no-unused-expressions
      self.updateSharedModels;
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const foundSharedModels = sharedModelManager?.isReady
        ? sharedModelManager.getTileSharedModels(self) as SharedDataSetType[]
        : [];
      return foundSharedModels;
    }
  }))
  .views(self => ({
    get title(): string | undefined {
      return getTileModel(self)?.title;
    },
  }))
  .views(self => ({
    get isLinked() {
      return self.linkedDataSets.length > 0;
    },
    get linkedTableIds() {
      return self.linkedDataSets.map(link => link.providerId);
    },
    isLinkedToTable(tableId: string) {
      return self.linkedDataSets.some(link => link.providerId === tableId);
    }
  }))
  .actions(self => ({
    setTitle(title: string) {
      setTileTitleFromContent(self, title);
    },
    addLinkedTable(tableId: string) {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady && !self.isLinkedToTable(tableId)) {
        const sharedTable = sharedModelManager.findFirstSharedModelByType(SharedDataSet, tableId);
        sharedTable && sharedModelManager.addTileSharedModel(self, sharedTable);
        self.forceSharedModelUpdate();
      }
      else {
        console.warn("GraphContent.addLinkedTable unable to link table");
      }
    },
    removeLinkedTable(tableId: string) {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady && self.isLinkedToTable(tableId)) {
        const sharedTable = sharedModelManager.findFirstSharedModelByType(SharedDataSet, tableId);
        sharedTable && sharedModelManager.removeTileSharedModel(self, sharedTable);
        self.forceSharedModelUpdate();
      }
      else {
        console.warn("GraphContent.addLinkedTable unable to unlink table");
      }
    }
  }))
  .actions(self => tileModelHooks({
    doPostCreate(metadata) {
      //self.metadata = metadata as any; // TODO: Change `any` to ? Maybe GraphMetadataModelType?
    }
  }))
  .actions(self => ({
    afterAttach() {
      // This reaction monitors legacy links and shared data sets, linking to tables as their
      // sharedDataSets become available.
      addDisposer(self, reaction(() => {
        const sharedModelManager: ISharedModelManager | undefined = self.tileEnv?.sharedModelManager;

        const sharedDataSets = sharedModelManager?.isReady
          ? sharedModelManager.getSharedModelsByType("SharedDataSet")
          : [];

        return { sharedModelManager, sharedDataSets, links: self.links };
      },
      // reaction/effect
      ({ sharedModelManager, sharedDataSets, links }) => {
        if (!sharedModelManager?.isReady) {
          // We aren't added to a document yet so we can't do anything yet
          return;
        }

        // Link to shared models when importing legacy content
        const remainingLinks: string[] = [];
        self.links.forEach(tableId => {
          const sharedDataSet = sharedModelManager.findFirstSharedModelByType(SharedDataSet, tableId);
          if (sharedDataSet) {
            sharedModelManager.addTileSharedModel(self, sharedDataSet);
          } else {
            // If the table doesn't yet have a sharedDataSet, save the id to attach this later
            remainingLinks.push(tableId);
          }
        });
        self.replaceLinks(remainingLinks);
      },
      {name: "sharedModelSetup", fireImmediately: true}));
    },
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      self.forceSharedModelUpdate();
    },
    syncLinkedChange(dataSet: IDataSet, links: ITableLinkProperties) {
      // TODO: handle update
    }
  }));

export function createGraphContentModel(snap?: GraphContentSnapshotType) {
  return GraphContentModel.create({
    axes: {
      bottom: EmptyAxisModel.create({place: "bottom"}),
      left: EmptyAxisModel.create({place: "left"})
    },
    ...snap
  });
}

export type GraphContentModelType = Instance<typeof GraphContentModel>;
export type GraphContentSnapshotType = SnapshotIn<typeof GraphContentModel>;

export type GraphMigratedContent = [GraphContentModelType, { title: string }];
