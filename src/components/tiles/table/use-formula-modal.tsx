import React, { useState } from "react";
// FIXME: webpack is honoring the exports field from the package.json
// but the CLUE typescript configuration does not.
// I'm afraid if I change that typescript configuration lots of things
// will break, but I'm going to try...
import { FormulaEditorContext, useFormulaEditorState
} from "@concord-consortium/codap-formulas-react17/components/common/formula-editor-context";
import { FormulaEditor } from "@concord-consortium/codap-formulas-react17/components/common/formula-editor";
import { getFormulaManager } from "@concord-consortium/codap-formulas-react17/models/formula/formula";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { IDataSet } from "../../../models/data/data-set";
import { TableContentModelType } from "../../../models/tiles/table/table-content";

import "./expressions-dialog.scss";

interface IProps {
  table: TableContentModelType;
  dataSet: IDataSet;
  onSubmit: () => void;
}

type IResult = [() => void, () => void, (id: string) => void];
export const useFormulaModal = ({ dataSet, onSubmit, table }: IProps) : IResult => {
  const [currYAttrId, _setCurrYAttrId] = useState<Maybe<string>>(() => {
    // If the dataSet has a second attribute, use that by default
    const yAttr = dataSet.attributes[1];
    return yAttr ? yAttr.id : undefined;
  });

  const getAttribute = (id: string) => {
    const _attr = dataSet.attrFromID(id);
    if (!_attr) {
      console.warn(`No attribute found for ID: ${id}`);
      return;
    }
    return _attr;
  };

  if (!currYAttrId) {
    console.warn("No Y attribute set");
  }
  const attr = getAttribute(currYAttrId || "");

  // Get the existing formulaDataSetProxy for this dataSet
  const formulaManager = getFormulaManager(dataSet);
  // This requires a typescript hack because the formulaManager doesn't officially expose
  // a way to lookup its datasets.
  const formulaDataSet = (formulaManager as any)?.dataSets.get(dataSet.id);

  // The useCustomModal hook will memoize the props of the Content component
  // as well as the button configurations.
  // useFormulaEditorState returns a new object on every call.
  // This is used to intentionally stop the memoization by useCustomModal,
  // We need the Content component to get the latest property values so busting this
  // memoization is necessary.
  const formulaEditorState = useFormulaEditorState(formulaDataSet, attr?.formula?.display || "");

  const setCurrYAttrId = (id: string) => {
    formulaEditorState.setFormula(getAttribute(id)?.formula?.display || "");
    _setCurrYAttrId(id);
  };

  // When FormulaEditor saves the formula by calling setFormula on formulaEditorState this is a react state
  // update. It triggers a re-render of the component using hook.
  // By themselves, changes in these content props do not directly trigger a re-render of the Content
  // component, they have to be passed as dependencies to the useCustomModal hook too.
  const contentProps: IContentProps = {
    currYAttrId,
    currYAttrName: attr?.name,
    setCurrYAttrId,
    formulaEditorState,
    dataSet
  };

  const handleClear = () => {
    if (!attr || !currYAttrId) {
      console.warn(`No attribute found for ID: ${currYAttrId}`);
      return;
    }
    table.setExpression(currYAttrId, "");
    onSubmit();
  };

  const handleSubmit = () => {
    if (!attr || !currYAttrId) {
      console.warn(`No attribute found for ID: ${currYAttrId}`);
      return;
    }

    // Save the formula to the attribute
    // we use the table model so the change is logged
    table.setExpression(currYAttrId, formulaEditorState.formula);
    onSubmit();
  };

  const [showModal, hideModal] = useCustomModal(
    {
      className: "set-expression",
      title: "Set Expression",
      Content,
      contentProps,
      buttons: [
        { label: "Clear", onClick: handleClear },
        { label: "Cancel" },
        { label: "OK", isDefault: true, onClick: handleSubmit }
      ]
    },
    // NOTE: formulaEditorState intentionally changes on every re-render so the modal will
    // re-render every time the table-tile using this hook re-renders.
    [currYAttrId, dataSet, formulaEditorState]
  );
  return [showModal, hideModal, setCurrYAttrId];
};
interface IContentProps {
  currYAttrId: Maybe<string>;
  currYAttrName: Maybe<string>;
  setCurrYAttrId: (id: string) => void;
  dataSet: IDataSet;
  formulaEditorState: ReturnType<typeof useFormulaEditorState>;
}

const Content: React.FC<IContentProps> = ({
  currYAttrId,
  currYAttrName,
  setCurrYAttrId,
  dataSet,
  formulaEditorState
}) => {
  console.log("FormulaModal Content render", {
    currYAttrId,
    formula: formulaEditorState.formula,
    formulaStateRenderIndex: (formulaEditorState as any).renderIndex
  });
  return (
    <>
      <label className="prompt">
        Enter an expression for{ " " }
        <select value={currYAttrId}
          onChange={e => {
            setCurrYAttrId(e.target.value);
          }}>
          {dataSet.attributes
            .map(attr => <option key={attr.id} value={attr.id}>{attr.name}</option>)}
        </select>
        { " " }:
      </label>
      <div className="expression">
        <label>
          <span className="attr-name y">{currYAttrName}</span>
          <span className="equals">=</span>
        </label>
        <FormulaEditorContext.Provider value={formulaEditorState}>
          <FormulaEditor editorHeight={30}/>
        </FormulaEditorContext.Provider>
      </div>
    </>
  );
};
