CLUE uses a data set model from CODAP.

It currently uses an older version of this data set model. This document describes some of the work needed to upgrade to a common DataSet used by both systems. This was written in May 2025. It is unlike this work will be started soon, so the notes in this document will not include features added to CLUE or CODAP after that time.

# Upgrade Notes

## Serialization changes
The serialized state of the data set and its children will be different.

### DataSet
In CLUE it currently has:
- cases: this looks like it was changed to `_itemIds`
- attributes: this looks like it was changed to an `attributeMap`
- name: this still exists in CODAP it was just moved to the V2Model super class model

In CODAP there are now extra fields:
- _title: this is optional so probably could be ignored
- collections: this is a core difference between CLUE and CODAP, it might be possible to use the CODAP dataset abstractions so CLUE can ignore the collection support, but it will be there incase it is needed in the future.
- snapSelection: CLUE does have a concept of selected cases, but I don't think it is serialized.
- setAsideItemIds: this can probably just left blank
- filterFormula: this is optional so can be left blank.

### Attribute
Many of the properties of the Attribute are still the same. Here are the differences:
- values: in CLUE this is an array of ValueType, in CODAP it is frozen `string[]`
- title: this is only in CLUE, there is a `_title` property in CODAP. It isn't clear if this CODAP title property is used. It isn't referenced directly by the Attribute model.
- hidden: this is only in CLUE. I think in CODAP info about whether an attribute is hidden would be stored in some metadata object.
- precision: this exists in both, but in CODAP it supports both a number and string value of the DatePrecision enumeration.
- userType: this is only in CODAP, it allows the user to specify a type for the attribute instead of the dataset automatically identifying the type from the values of the attribute.

### CollectionModel
This is only in CODAP. Besides supporting collections it is also have CODAP orders the attributes in the dataset. It has an array of references to Attributes.
It also has `_groupKeyCaseIds` which is a frozen array of [group key, case id].

So if we did switch to using the CODAP model directly we'd have to use a single CollectionModel to store the order of the attributes.

## Actions

### CODAP

#### Internal
- prepareSnapshot
- completeSnapshot
- afterCreate

#### In CLUE
- moveAttribute
- beingTransaction
- endTransaction
- setName
- setAttributeName
- removeAttribute
- setCaseValues
- removeCases
- selectCases
- setSelectedCases

#### Not in CLUE
- incSyncCollectionLinksCount
- addCollection
- removeCollection
- setManagingControllerId
- clearFilterFormula
- hideCasesOrItems
- showHiddenCasesAndItems
- setFilterFormula
- updateFilterFormulaResults
- setFilterFormulaError
- moveAttributeToNewCollection
- addAttribute
- addCases
- moveItems
- selectAll
- syncCollectionLinks
- commitCache
- endCaching
- removeCollectionWithAttributes
- sortByAttribute

### CLUE

#### Internal
- afterCreate
- beforeDestroy

#### In CODAP
- beginTransaction
- endTransaction
- setName
- setAttributeName
- removeAttribute
- moveAttribute
- setCaseValues
- removeCases
- selectCases
- setSelectedCases

#### Not in CODAP reviewed
- selectAllCases: this includes the same thing as selectAll in CODAP, however it also clears the attributeSelection and cellSelection.
- selectAllAttributes: specific to CLUE
- selectAllCells: specific to CLUE
- selectCells: specific to CLUE
- selectAttributes: specific to CLUE
- setSelectedAttributes: specific to CLUE
- clearAllSelections: specific to CLUE
- addActionListener: this is not called
- removeActionListener: this is not called
- addAttributeWithID : there is an Collection#addAttribute and also a DataSet#addAttribute

#### Not in CODAP not reviewed
- addCasesWithIDs: there is a `addCases` action in CODAP
- addCanonicalCasesWithIDs: no reference to canonical in CODAP
- setCanonicalCaseValues: no reference to canonical in CODAP


#### Residual Stuff
In CLUE there is a `pseudoCaseMap` volatile. This case map seems to be read but never updated in CLUE. From what I can tell it is an early version of Collections in CODAP.

## Differences in functionality

### Selection
In CLUE there is cell, case, and attribute selection. Selecting one of these items deselects the other items. However there is a app level config which allows selecting cells to also select their cases. The modeling supports multiple selection, but the table doesn't seem to support shift or command/control to do multiple selection. All of these selections are via the dataset, so other tiles can update their representation of the data based on this selection. The selection is stored in 3 volatile observable set properties.

In CODAP there is no attribute selection. There is case selection but only a single case at a time and it is specific to the table tile where the cell was selected. Case selection works the same.

If we are trying to share the same dataset model unmodified, CLUE would have to manage this attribute and cell selection outside of the base dataset model. It could be done either as a dataset extension, or via some extended shared metadata.


## Observability
In CLUE the dataset should be fully observable. So if a component is rendering something based on the dataset values this component will be updated when the values change. In CODAP the values are stored outside of MobX, so changes to the values don't automatically trigger updates.

TODO: look at what effect this will have on CLUE code. Perhaps by doing an audit of how it is handled in CODAP.

## Combination with Variables
There is an overlap between attributes and variables. Both can be defined with formulas based on other Attributes or variables.

It is difficult to figure out how to combine these concepts.

It might be sufficient to add a concept of Attribute chips like we have variable chips.

## Steps to share dataset with CODAP
- find a way to handle cell and attribute selection. This might mean some refactoring of CODAP's selection which might be pretty involved. But probably it is better if we see if we can just make a subclass or tack it on as an extra shared model.
- try to turn CODAP into a mono-repo so we can actually separate out the dataset into an independent library. This would also let us turn the pieces used by the dst plugin into libraries. Now seems like a good time to try this because there aren't many people working on CODAP right now.
- figure out the observability issues, I don't have a good handle on this.
- I could try an incremental approach like I did with the dst plugin, but in this case it will be harder because I'd be merging CLUE code with the CODAP code.
