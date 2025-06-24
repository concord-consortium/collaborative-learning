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
