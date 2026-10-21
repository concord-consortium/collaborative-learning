import { types } from "mobx-state-tree";
import {
  FormulaManager
} from "@concord-consortium/codap-formulas/models/formula/formula-manager";
import {
  createFormulaAdapters
} from "@concord-consortium/codap-formulas/models/formula/formula-adapter-registry";
import {
  AttributeFormulaAdapter
} from "@concord-consortium/codap-formulas/models/formula/attribute-formula-adapter";
import { createFormulaDataSetProxy } from "../data/formula-data-set-proxy";
import { SharedDataSet, SharedDataSetType } from "../shared/shared-data-set";
import { registerRankFunction } from "./rank-function";

// A formula reaches its manager through the MST environment, so the dataset has to be in a tree
// that carries one.
const Container = types.model("FormulaTestContainer", { sharedDataSet: SharedDataSet });

/**
 * Sets the formula engine up over `sharedDataSet`, which must not already be in a tree, and
 * evaluates its formulas. Mirrors what `initialize-app` and `createDocumentModel` do between them,
 * so a formula tested through this behaves as it will in a document.
 */
export function evaluateFormulas(sharedDataSet: SharedDataSetType) {
  const formulaManager = new FormulaManager();
  const adapterApi = formulaManager.getAdapterApi();
  Container.create({ sharedDataSet }, { formulaManager });
  registerRankFunction();
  AttributeFormulaAdapter.register();
  formulaManager.addAdapters(createFormulaAdapters(adapterApi));
  formulaManager.addDataSet(createFormulaDataSetProxy(sharedDataSet.dataSet));
}
