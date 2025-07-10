CLUE uses the same formula system as CODAP. It is used as a library. Currently this library is published to NPM from the `CODAP-740-formula-library` branch of CODAP. This branch breaks up CODAP into multiple packages in a monorepo, so the formula system can be published independently.

# Known Issues
- when a value of a cell is a fraction like `1/2` this breaks mathjs's interpreter when it substitutes the value into the formula.
- CODAP's "insert function" and "insert value" buttons have not been added.

# Observing DataSet changes
The formula system library watches for calls to setCaseValues on the dataset. Because we are proxying the dataset this won't happen automatically. Luckily, it also watches the `itemIdsHash` to know when a new case is added or removed. Because `itemIdsHash` is only used for this watching purpose, CLUE abuses it and makes it be a hash of all of the values of all of the attributes of the dataset. This triggers the formulas to recalculate when the values change in CLUE.

# Stored values
When the formula system's attribute formula adapter computes the formula of an attribute it stores the computed values directly in the dataset. So any code using the dataset doesn't have to know about formulas it can just use the dataset values.

# FormulaDataSetProxy
The formula system is built around the CODAP data set. This data set supports collections and has a few other methods that CLUE doesn't have. This mismatch is addressed via the FormulaDataSetProxy.

Because the formula system expects this dataset object to be a MST model that is what the FormulaDataSetProxy is. It doesn't have any MST properties just the CLUE dataSet as a volatile property.

The formula manager's list of proxied data sets is kept in sync with the CLUE data sets in document.ts. The table component also needs a formula data set to pass to the formula editor component. It hacks into the formulaManager's `dataSets` property to find the already created formula data set proxy for the table's CLUE data set.

# CodeMirror
The syntax highlighting and auto completion of the formula system is handled by Code Mirror.
