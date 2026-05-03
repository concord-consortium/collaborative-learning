import { comparer, observable } from "mobx";
import { addDisposer, destroy, getType, Instance, isAlive, ISerializedActionCall, types } from "mobx-state-tree";
import { IAttribute } from "../data/attribute";
import { CategorySet, createProvisionalCategorySet, ICategorySet } from "../data/category-set";
import { DataSet, IDataSet } from "../data/data-set";
import { SharedModelType, SharedModel } from "./shared-model";
import { mstReaction } from "../../utilities/mst-reaction";

export const kSharedCaseMetadataType = "SharedCaseMetadata";

export const CollectionTableMetadata = types.model("CollectionTable", {
  // key is valueJson; value is true (false values are deleted)
  collapsed: types.map(types.boolean)
});

export const SharedCaseMetadata = SharedModel
  .named(kSharedCaseMetadataType)
  .props({
    type: types.optional(types.literal(kSharedCaseMetadataType), kSharedCaseMetadataType),
    data: types.safeReference(DataSet),
    // key is collection id
    collections: types.map(CollectionTableMetadata),
    // key is attribute id
    categories: types.map(CategorySet),
    // key is attribute id; value is width
    columnWidths: types.map(types.number),
    // key is attribute id; value is true (false values are deleted)
    hidden: types.map(types.boolean)
  })
  .volatile(() => ({
    // CategorySets are generated on demand whenever something needs to treat
    // an attribute categorically. CategorySets only need to be saved when they
    // contain user modifications (re-orderings or color assignments). CategorySets
    // created automatically before any user modification live here as
    // "provisional" sets and are promoted to the persistent `categories` map when
    // the user first modifies one. This keeps them from cluttering up history.
    provisionalCategories: observable.map<string, ICategorySet>(),
    // Tracks attrIds that already have a cleanup disposer installed on their
    // Attribute, so the attribute-watching reaction doesn't re-register.
    _attrsWithCleanupDisposer: new Set<string>()
  }))
  .views(self => ({
    columnWidth(attrId: string) {
      return self.columnWidths.get(attrId);
    },
    // true if passed the id of a parent/pseudo-case whose child cases have been collapsed, false otherwise
    isCollapsed(caseId: string) {
      const { collectionId, valuesJson } = self.data?.pseudoCaseMap[caseId] || {};
      return (collectionId && valuesJson && self.collections.get(collectionId)?.collapsed.get(valuesJson)) ?? false;
    },
    // true if passed the id of a hidden attribute, false otherwise
    isHidden(attrId: string) {
      return self.hidden.get(attrId) ?? false;
    },
    getCategorySet(attrId: string): ICategorySet | undefined {
      // Persistent has priority. Read both maps unconditionally so MobX tracks
      // dependencies on both — otherwise `??` would short-circuit and skip
      // tracking provisionalCategories whenever a persistent entry exists.
      const persistent = self.categories.get(attrId);
      const provisional = self.provisionalCategories.get(attrId);
      return persistent ?? provisional;
    }
  }))
  .actions(self => ({
    setData(data?: IDataSet) {
      self.data = data;
    },
    setColumnWidth(attrId: string, width?: number) {
      if (width) {
        self.columnWidths.set(attrId, width);
      }
      else {
        self.columnWidths.delete(attrId);
      }
    },
    setIsCollapsed(caseId: string, isCollapsed: boolean) {
      const { collectionId, valuesJson } = self.data?.pseudoCaseMap[caseId] || {};
      if (collectionId && valuesJson) {
        let tableCollection = self.collections.get(collectionId);
        if (isCollapsed) {
          if (!tableCollection) {
            tableCollection = CollectionTableMetadata.create();
            self.collections.set(collectionId, tableCollection);
          }
          tableCollection.collapsed.set(valuesJson, true);
        }
        else if (tableCollection) {
          tableCollection.collapsed.delete(valuesJson);
        }
      }
    },
    setIsHidden(attrId: string, hidden: boolean) {
      if (hidden) {
        self.hidden.set(attrId, true);
      }
      else {
        self.hidden.delete(attrId);
      }
    },
    showAllAttributes() {
      self.hidden.clear();
    }
  }))
  .actions(self => ({
    removeCategorySet(attrId: string) {
      self.categories.delete(attrId);
    }
  }))
  .actions(self => ({
    _cleanupAttribute(attrId: string) {
      // Remove any attribute-keyed state left behind when an Attribute is
      // destroyed. Add more here (e.g. columnWidths, hidden) as needed —
      // anything keyed by attrId should be cleaned up in one place.
      //
      // Persistent: delegate to the action so MST's action protection permits
      // the map mutation even when this runs inside a DataSet action context.
      if (self.categories.has(attrId)) self.removeCategorySet(attrId);
      // Provisional: volatile map, not protected.
      const provisional = self.provisionalCategories.get(attrId);
      if (provisional) {
        self.provisionalCategories.delete(attrId);
        destroy(provisional);
      }
      self._attrsWithCleanupDisposer.delete(attrId);
    }
  }))
  .actions(self => ({
    _ensureAttributeCleanupDisposer(attribute: IAttribute) {
      if (self._attrsWithCleanupDisposer.has(attribute.id)) return;
      self._attrsWithCleanupDisposer.add(attribute.id);
      // Single disposer per Attribute. When the Attribute is destroyed —
      // via removeAttribute, moveAttribute, DataSet destruction, or patch
      // playback — this disposer removes any CategorySet (provisional OR
      // persistent) keyed by that attribute's id. Keying cleanup off the
      // Attribute lifecycle (not the CategorySet's) means cleanup works
      // regardless of when or how the CategorySet came into existence:
      // fresh inserts, snapshot rehydration, and patch-added entries are
      // all handled uniformly.
      addDisposer(attribute, () => {
        // Guard against SharedCaseMetadata having been destroyed before the
        // Attribute. MST's addDisposer has no way to unregister a disposer
        // from a foreign node when `self` dies first, so the disposer can
        // outlive us. Calling an action on a dead tree would throw.
        if (!isAlive(self)) return;
        self._cleanupAttribute(attribute.id);
      });
    }
  }))
  .actions(self => ({
    afterAttach() {
      // Install a cleanup disposer for every attribute in the associated
      // DataSet, reactively as attributes are added. Runs immediately for
      // attributes already present at rehydration time. The reaction is
      // tied to this model's lifecycle by mstReaction.
      mstReaction(
        () => self.data?.attributes.map(a => a.id) ?? [],
        () => self.data?.attributes.forEach(a => self._ensureAttributeCleanupDisposer(a)),
        { name: "SharedCaseMetadata.ensureAttributeCleanupDisposers",
          fireImmediately: true, equals: comparer.structural },
        self
      );
    }
  }))
  .actions(self => ({
    ensureProvisionalCategorySet(attrId: string): ICategorySet | undefined {
      // Idempotent: return any existing instance unchanged.
      const existing = self.getCategorySet(attrId);
      if (existing) return existing;

      const attribute = self.data?.attrFromID(attrId);
      if (!self.data || !attribute) return undefined;

      const categorySet = createProvisionalCategorySet(self.data, attrId);
      self.provisionalCategories.set(attrId, categorySet);

      // Cleanup on attribute destruction is handled by the per-attribute
      // disposer installed by `_ensureAttributeCleanupDisposer` from the
      // afterAttach reaction above. That disposer removes any CategorySet
      // (provisional or persistent) keyed by this attribute's id, keying
      // cleanup off the Attribute lifecycle rather than per ensure-call.
      return categorySet;
    },
    ensurePersistentCategorySet(attrId: string): ICategorySet | undefined {
      const existing = self.categories.get(attrId);
      if (existing) return existing;

      if (!self.data?.attrFromID(attrId)) return undefined;

      // Create a fresh persistent entry. Because provisional instances can
      // never be mutated (see the guard in category-set.ts), there is no
      // mutable state on the provisional that needs to be carried over to
      // the new persistent instance.
      self.categories.set(attrId, { attribute: attrId });
      const persistent = self.categories.get(attrId);

      // Dispose any existing provisional so stale references explode.
      const provisional = self.provisionalCategories.get(attrId);
      if (provisional) {
        self.provisionalCategories.delete(attrId);
        destroy(provisional);
      }

      // Cleanup on Attribute destruction is handled by a disposer installed
      // from CategorySet.afterAttach, which fires for every attach path
      // (fresh insert, snapshot rehydration, patch-materialized entries).
      // The disposer calls removeCategorySet on this model.
      return persistent;
    }
  }));
export interface ISharedCaseMetadata extends Instance<typeof SharedCaseMetadata> {}

export function isSharedCaseMetadata(model?: SharedModelType): model is ISharedCaseMetadata {
  return model ? getType(model) === SharedCaseMetadata : false;
}

export interface SetIsCollapsedAction extends ISerializedActionCall {
  name: "setIsCollapsed"
  args: [string, boolean] // [caseId, isCollapsed]
}

export function isSetIsCollapsedAction(action: ISerializedActionCall): action is SetIsCollapsedAction {
  return action.name === "setIsCollapsed";
}
