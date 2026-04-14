import { observable } from "mobx";
import { addDisposer, destroy, getType, Instance, ISerializedActionCall, types } from "mobx-state-tree";
import { CategorySet, createProvisionalCategorySet, ICategorySet } from "../data/category-set";
import { DataSet, IDataSet } from "../data/data-set";
import { SharedModelType, SharedModel } from "./shared-model";

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
    provisionalCategories: observable.map<string, ICategorySet>()
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
    ensureProvisionalCategorySet(attrId: string): ICategorySet | undefined {
      // Idempotent: return any existing instance unchanged.
      const existing = self.categories.get(attrId) ?? self.provisionalCategories.get(attrId);
      if (existing) return existing;

      const attribute = self.data?.attrFromID(attrId);
      if (!self.data || !attribute) return undefined;

      const categorySet = createProvisionalCategorySet(self.data, attrId);
      self.provisionalCategories.set(attrId, categorySet);

      // Clean up the provisional when the underlying Attribute node is
      // destroyed. We use `addDisposer(attribute, ...)` rather than watching
      // the DataSet's `removeAttribute` action by name because:
      //
      //   1. Attributes can be destroyed by many paths — removeAttribute,
      //      moveAttribute (which splices the instance out and recreates it),
      //      DataSet destruction, applySnapshot/applyPatch during history
      //      playback. `addDisposer(attribute, ...)` fires on all of them.
      //   2. MST fires disposers synchronously, inside the destruction call
      //      stack. That means this cleanup runs INSIDE the outer action that
      //      triggered the destruction (e.g. removeAttribute), and the tree
      //      monitor's action-tracking middleware groups it under that single
      //      top-level action — producing one history entry, not two.
      //
      // This is the provisional counterpart to the persistent path's
      // `onInvalidated` callback on the `types.reference(Attribute, ...)`
      // below in ensurePersistentCategorySet. Both mechanisms are synchronous
      // and same-action by MST's guarantees; both exist so that cleanup never
      // produces a stray history entry. Do not convert either to a MobX
      // reaction — reactions fire after the action completes, which would
      // create a second top-level action and a second history entry.
      addDisposer(attribute, () => {
        const stale = self.provisionalCategories.get(attrId);
        if (stale) {
          self.provisionalCategories.delete(attrId);
          destroy(stale);
        }
      });

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

      // Persistent instances rely on MST's native `onInvalidated` callback on
      // the `types.reference(Attribute, ...)` prop in CategorySet. MST fires
      // that callback synchronously from inside the reference-resolution
      // pipeline when the referenced Attribute node is destroyed. We route it
      // through `removeCategorySet` here, same as the old `addCategorySet`
      // action used to. This is the persistent counterpart to the
      // `addDisposer(attribute, ...)` hook above in ensureProvisionalCategorySet
      // — see that comment for the full rationale about synchronous cleanup.
      persistent?.onAttributeInvalidated((invalidAttrId: string) => {
        self.removeCategorySet(invalidAttrId);
      });
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

// Thin wrapper for backward compatibility. Use metadata.getCategorySet directly
// in new code.
export function getCategorySet(metadata: ISharedCaseMetadata, attrId: string): ICategorySet | undefined {
  return metadata.getCategorySet(attrId);
}
