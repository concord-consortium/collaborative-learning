import React from "react";
import { Editable, EditableInput, EditablePreview, useEditableControls } from "@chakra-ui/react";
import { observer } from "mobx-react";
import { IDataConfigurationModel } from "../../models/data-configuration-model";

import EditIcon from "../../assets/edit-legend-name-icon.svg";

interface IProps {
  dataConfiguration: IDataConfigurationModel;
}

export const EditableDataSetName = observer(function EditableDataSetName({dataConfiguration}: IProps) {

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

  function handleOnSubmit(val: string) {
    if (val) {
      dataConfiguration.dataset?.setName(val);
    }
  }

  return (
    <Editable
      defaultValue={dataConfiguration.dataset?.name || "Unknown"}
      isPreviewFocusable={false}
      onSubmit={handleOnSubmit}
    >
      <EditablePreview />
      <EditableInput />
      <EditButton />
    </Editable>
  );
});
