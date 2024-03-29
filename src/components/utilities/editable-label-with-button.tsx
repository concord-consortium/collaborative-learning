import React from "react";
import { observer } from "mobx-react";
import { Editable, EditableInput, EditablePreview, useEditableControls } from "@chakra-ui/react";

import EditIcon from "../../assets/edit.svg";

import "./editable-label-with-button.scss";

interface IProps {
  defaultValue: string|undefined;
  onSubmit: (value:string) => void;
}

/**
 * Generic component for an in-place editable label.
 *
 * Differs from stock <Editable> in that there's an explicit edit button rather
 * than invoking edit mode by clicking on the label text itself.
 */
export const EditableLabelWithButton = observer(function EditableDataSetName({defaultValue, onSubmit}: IProps) {

  return (
    <Editable
      defaultValue={defaultValue}
      isPreviewFocusable={false}
      onSubmit={onSubmit}
    >
      <EditablePreview />
      <EditableInput onKeyDown={handleKeyDown}/>
      <EditButton />
    </Editable>
  );
});

// By default Chakra <EditableInput> lets keyboard events propagate.
// This can lead to keyboard shortcuts being fired on the tile when user is typing in the input.
// Adding a stopPropagation prevents this.
function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  e.stopPropagation();
}

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
