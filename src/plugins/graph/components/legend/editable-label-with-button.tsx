import React from "react";
import { observer } from "mobx-react";
import { Editable, EditableInput, EditablePreview, useEditableControls } from "@chakra-ui/react";

import EditIcon from "../../assets/edit-legend-name-icon.svg";

interface IProps {
  defaultValue: string|undefined;
  onSubmit: (value:string) => void;
}

export const EditableLabelWithButton = observer(function EditableDataSetName({defaultValue, onSubmit}: IProps) {

  function EditButton() {
    const { isEditing, getEditButtonProps } = useEditableControls();
    if (!isEditing) {
      return (
        <button aria-label="Edit name" {...getEditButtonProps()}>
          <EditIcon/>
        </button>
      );
    } else {
      return null;
    }
  }

  return (
    <Editable
      defaultValue={defaultValue}
      isPreviewFocusable={false}
      onSubmit={onSubmit}
    >
      <EditablePreview />
      <EditableInput />
      <EditButton />
    </Editable>
  );
});
