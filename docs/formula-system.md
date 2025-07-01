# Known Issues
- when a value of a cell is a fraction like `1/2` this breaks mathjs's interpreter when it substitutes the value into the formula.
- the aggregate functions stopped working but no are working again and it isn't clear why.
- **fixed** when clicking on a equation below a header to edit it, it doesn't show the right value in the editor field. If you toggle the pull down to a different attribute and back again, then it does show the right equation in the editor field.
- when the value of a cell is changed the formulas do not recompute.
- when there is a chain of formulas at least 3 long which depend on each other it seems to break the formula system. It reports an error of: "Undefined symbol __CANONICAL_NAME_LOCAL_ATTR_...". CODAP does not have this problem.
- CODAP's "insert function" and "insert value" buttons have not been added.
- in the Jest tests when an equation is added to an attribute this doesn't seem to trigger an update of the cells of that attribute, how ever this does work in the main app
- in the Jest tests randomly mathjs complains about getting the canonical form the variable in the equation. I'm not sure if that canonical form is what is always used, and the problem is that the context of the formula is not setup correctly. Or if the canonical form is being used incorrectly in this case.
- the upgrade of MST seems to have changed the behavior of the `updateAfterSharedModelChanges` callback. The test at `shared-model-document-manager.test.ts:649` is now showing that it is called extra times than what is expected. However we need to look at the behavior was like before all of this work to understand what the work actually changed. It looks like if only a single extra call happens at the beginning the test would still pass, so that might have been happening already. It is only when there are 2 extra calls that test starts to fail. Interestingly in CODAP this is test was not updated, so possibly some changes to the shared model manager were made to address this issue in CODAP. We should compare the two implementations, and look at the PRs in CODAP that updated it.

# Observing DataSet changes
The formula system watches for calls to setCaseValues on the dataset. Because we are proxying the dataset this won't happen automatically.
It also watches the `itemIdsHash` to know when a new case is added or removed. Because `itemIdsHash` is only used for this watching purpose, we abuse it and make it be a hash of all of the values of all of the attributes of the dataset. This triggers the formulas to recalculate when the values change in CLUE.

There has been an intermittent problem where some attributes don't update after a value is changed. It seems when this happens `setCanonicalCaseValues` is being called with the correct computed value, but the actual dataset doesn't save the change. However I haven't been able to reproduce it after adding logging to verify that.

# Notes during migration

- CLUE formula object has state variable `canonical` in CODAP that is a volatile so we'll have to ignore it during import. I think without strict MST type checking it should just be ignored automatically.
- CLUE attributes have a formula property, CODAP attributes do too.
- CLUE attributes have setDisplayFormula, and setFormula which both take a display and canonical formula.
- CLUE data-set:
  - addAttributeWithID
- CLUE shared-data-set:
- Clue table-content:
- CLUE table-import:
- table-contents calls setExpressions which calls attribute setFormula
- use-content-change-handler setColumnExpressions calls setExpressions
- use-content-change-handler shares setColumnExpressions through the returned onSetColumnExpressions prop
- table-tile.tsx handleSubmitExpressions calls onSetColumnExpressions
- in table-tile.tsx useExpressionDialog is called with its onSubmit property as handleSubmitExpressions. It is also passed a dataSet.
- the showExpressionDialog function from useExpressionDialog is called by handleShowExpressionsDialog which is passed the attribute Id.
- useExpressionDialog calls useCustomModal to display the modal dialog, it is passed a Content component along with the properties to be displayed.

## CLUE formulas
In CLUE the table metadata has the expression and rawExpression values. Hopefully we can replace this and then get rid of one more CLUE metadata object.

The use-column-extensions module is the only one that uses `TableMetadataModel.hasExpression`.
Only use-column-extensions uses `TableMetadataModel.expressions` (besides TableMetadataModel itself)

The table metadata is what currently updates the dataset based on the expression. This is called manually by the TableContentModel when cases are added or changed, and attributes added or removed, and when the expression is changed via the table-content.

All of this should be replaceable by the formula observer system from CODAP. As long as these changes trigger the observer automatically via the formula data set proxy. Otherwise we might need to manually call these triggers.

The point of use-column-extensions is to setup the appData property of the column object passed to RDG. This appData is typed as TColumnAppData.

column-header-cell is the consumer of:
- readOnly (passed into use-column-extensions)
- gridContext (passed into use-column-extensions)
- isEditing (based on passed in columnEditingName)
- isRemovable (based on multiple conditions (not including the expressions))
- showExpressions (based on metadata.hasExpressions)
- expression (based on metadata.rawExpression, metadata.expression, and xName it recomputes the editable expression if the rawExpression was cleared this happens when the x attribute is renamed)
- hasData (checks if dataset has data for this column)
- onShowExpressionsDialog (passed in)
- onRemoveColumn (passed in)

editable-header-cell is the consumer of:
- gridContext
- editableName
- isEditing
- onBeginHeaderCellEdit
- onHeaderCellEditKeyDown
- onEndHeaderCellEdit

cell-text-editor is the consumer of:
- onBeginBodyCellEdit (this doesn't seem to be implemented)
- onEndBodyCellEdit (this doesn't seem to be implemented)


There is no inline editing of the formula. The dialog is opened when the expression is single clicked below the header name.

Steps to update:
- remove table metadata?


## Getting formulas to recompute
- we need to call formulaManager.addAdapters() in CODAP this is done in create-document-model. This sets up an MobX observer on the active formulas of each adapter and recomputes them when these active formulas changes. This will handle the computation of a newly added formula object.
- this requires an adapterApi implementation provided by CLUE.

## Possible Plan
- update the Content component used in useExpressionDialog to do what the CODAP Expression Modal Editor does. This content is being passed the dataset so it should be able to setup the formula context, with this dataset. Might be easiest to start a new "use..." file then we can see what happens with the types.
- might need to create a separate version of formula system which has peerDependencies on chakra, mobx-state-tree, and whatever else. My plan is to try to find some basic way to use it in CLUE and then see if we get any errors before working on that part of things.

### Concerns
- version of chakra is probably different so there will be issues mixing the two.
- version of mobx-state-tree is also probably different


# Review before bringing over CODAP formulas
We are considering bringing over the CODAP formula system into CLUE.

We need an estimate of how much it would cost to bring it over and make it work in CLUE.

The alternative is to just do some incremental changes to the current formula system in CLUE, or switch it to use MathJS with a custom context.

Shared formula plan:
- (2 days) setup mono-repo in CODAPv3
- (3 days) create DataSet abstraction that the formula system can use without directly using the DataSet since it is different between CLUE and CODAP. Copilot looked at it and suggested the interface below. And also the need for a few more pieces from CODAP to be exposed.
- (1 day) create a formula package that includes the formula system
- (1 day) add the formula editor to the formula system package, or a separate package, the formula editor depends on a few more parts of CODAP so will take a bit more to extract.
- (5 days) update CLUE to use this formula package:
  - it will have to implement the interfaces for the DataSet and other services used by the formula system.
  - most likely this will require some changes to the formula system in CODAP once we actually start using it CLUE.

## Notes about current CODAP system

More details can be found in: https://github.com/concord-consortium/codap/blob/d7f6a6bfa3300d71e0f0ea38617163fcbdcafaa7/v3/doc/formulas.md

When the attribute-formula-adapter computes an attribute value it stores the result in the dataset. This value is only recomputed under certain conditions.

The AttributeFormulaAdapter does have a hardcoded dependency on collections. It seems like it wouldn't be too hard to extract this out so the formula system could provide a generic attribute adapter which doesn't have this dependency.

There doesn't seem to currently be a way to control which functions are available in different contexts. However the functions are divided up nicely so it doesn't seem to hard to customize this.

The syntax highlighting and auto completion is done by code mirror. The list of functions and attributes are passed into the auto completion list of symbols. It isn't clear how this list is passed to the highlighting. The highlighting seems to just be passed on the grammar with the list of functions. But if a function like `foo()` is used it is not highlighted the same as `first()`. The CODAP function highlighting seems to be handled by the `CodapHighlightingPluginClass`. So there are two highlighting configurations:
- `formulaLanguageWithHighlighting`
- `codapHighlightingViewPlugin`

## Ideas on extracting Formula system

```js
// Suggestion for a minimal IDataSet interface for formula system
export interface IFormulaDataSet {
  id: string
  title: string
  attributes: IAttribute[]
  collections: ICollection[]
  items: ICase[]
  caseInfoMap: Map<string, ICaseInfo>
  childCollection: ICollection
  filterFormula?: IFormula
  hasFilterFormula?: boolean

  getCollectionForAttribute(attrId: string): ICollection | undefined
  getCollectionIndex(collectionId: string): number
  getCasesForAttributes(attrIds: string[]): ICase[]
  setCaseValues(cases: Array<{ __id__: string, [attrId: string]: any }>): void
  attrFromID(attrId: string): IAttribute | undefined
  attrIDFromName(name: string): string | undefined
  getItem(id: string): ICase | undefined
  getValueAtItemIndex(index: number, attrId: string): any
  addCases(cases: ICase[]): void
  removeAttribute(attrId: string): void
  setAttributeName(attrId: string, name: string): void
  updateFilterFormulaResults?(results: any[], options: { replaceAll: boolean }): void
  itemsNotSetAside?: string[]
  itemIdsHash?: string
}
```

```js
export interface IFormulaDataSetManager {
  getDataSet(id: string): IFormulaDataSet | undefined
  getAllDataSets(): Iterable<IFormulaDataSet>
  getDataSetByTitle?(title: string): IFormulaDataSet | undefined
}
```

Then also the `BoundaryManager` and `IGlobalValueManager` is needed.

Note however that `IAttribute`, `ICase`, `ICollection`, and `ICaseInfo` are also needed. So we'd have to see where we can find overlaps between CLUE and CODAP.

We might be able to extract the parts that care about the Collection info out of the core formula library. This will be tricky because it means extracting the aggregate function grouping approach. This would have to be a feature of the dataset abstraction where the formula system could ask for the grouping used for aggregate functions. I think this would only be customized for attribute formulas which have collection context because of where the attribute is that is being computed. However there might be other cases that I'm missing where a function is collection aware regardless of the context of the function.

For attributes we might need the attribute to be an opaque object that is then passed to the manager to get information about it. Particularly getting the values is probably different between CLUE and CODAP.

For ICase it is pretty basic so that shouldn't be too hard to handle abstractly.

For CaseInfo, this is related to collections. It is only used by the attribute formula adapter. So it shouldn't be too hard to deal with.

### Collection dependencies
- attribute formula adapter adds hierarchy observer which looks at the collections of the dataset
- aggregate functions use collection information both for the collection of the formula and the collection(s) of the dependencies of the formula. If the dependencies are in a child collection then the aggregate groups over the child collection.
- filter formula adapter references Collections but basically it is just referring to the child most cases which I think means it is like ignoring collections, so I think this is reference can be handled without collection support
