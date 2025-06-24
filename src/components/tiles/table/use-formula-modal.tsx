import React, { useState } from "react";
// FIXME: webpack is honoring the exports field from the package.json
// but the CLUE typescript configuration does not.
// I'm afraid if I change that typescript configuration lots of things
// will break, but I'm going to try...
import { FormulaEditorContext, useFormulaEditorState
} from "@concord-consortium/codap-formulas/dist/components/common/formula-editor-context";


import { useCustomModal } from "../../../hooks/use-custom-modal";
import { IDataSet } from "../../../models/data/data-set";
import { createFormulaDataSetProxy } from "../../../models/data/formula-data-set-proxy";

interface IProps {
  dataSet: IDataSet;
}

type IResult = [() => void, () => void, React.Dispatch<React.SetStateAction<string | undefined>>];
export const useFormulaModal = ({ dataSet }: IProps) : IResult => {
   const [currYAttrId, setCurrYAttrId] = useState<string>();

  const contentProps: IContentProps = {
      dataSet, currYAttrId
  };

  const handleSubmit = () => {};

  const [showModal, hideModal, burModal] = useCustomModal({
    title: "Edit Formula",
    Content,
    contentProps,
    buttons: [
      { label: "Cancel" },
      { label: "OK", isDefault: true, onClick: handleSubmit }
    ]
  });
  return [showModal, hideModal, setCurrYAttrId];
};
interface IContentProps {
  dataSet: IDataSet;
  currYAttrId: string | undefined;
}

const Content: React.FC<IContentProps> = ({
  dataSet, currYAttrId
}) => {
  const formulaDataSet = createFormulaDataSetProxy(dataSet);
  const formulaEditorState = useFormulaEditorState(formulaDataSet, "");

  return (
    <FormulaEditorContext.Provider value={formulaEditorState}>
      <div>Hello World</div>
    </FormulaEditorContext.Provider>
  );
};
