import { DisplayDialogSettings, Editor, FieldType, IDialogController, 
  IFieldValues, IModalDialogProps, ModalDialog } from "@concord-consortium/slate-editor";
import { clone } from "lodash";
import { useMemo, useRef, useState } from "react";
import { useCustomModal } from "../../hooks/use-custom-modal";

interface IProps {
  editor?: Editor;
}

export const useTextToolDialog = ({editor}: IProps) => {
  // Fake ref
  const settingsRef = useRef<DisplayDialogSettings>();
  const validValuesRef = useRef<IFieldValues>();
  const [,setChanges] = useState(0);

  const setFieldValues = (newValues: IFieldValues) => {
    if (!settingsRef.current) return;
    settingsRef.current.values = { ...settingsRef.current.values, ...newValues };
    setChanges(count => count + 1);
  };

  const validateFieldValues = () => {
    if (settingsRef.current) {
      validValuesRef.current = clone(settingsRef.current.values);
    }
  };

  const handleSetValue = (name: string, value: string, type: FieldType) => {
    setFieldValues({ [name]: value });
    if (type !== "input") {
        callOnChange(name, value);
    }
  };

  const handleChange = (name: string, value: string, type: FieldType) => {
    if (type === "input") {
      callOnChange(name, value);
    }
  };

  const callOnChange = (name: string, value: string) => {
    if (editor && settingsRef.current?.onChange) {
      const { values } = settingsRef.current;
      const isValid = settingsRef.current.onChange(editor, name, value, values) !== false;
      if (isValid) {
        validateFieldValues();
      }
      else {
        setFieldValues({ [name]: validValuesRef.current?.[name] || "" });
      }
    }
  };

  const handleClose = (values?: IFieldValues) => {
    hideDialog();
    editor && values && settingsRef.current?.onAccept?.(editor, values);
  };

  const dialogProps: IModalDialogProps = {
    title: settingsRef.current?.title || "",
    rows: settingsRef.current?.rows || [],
    fieldValues: settingsRef.current?.values || {}, 
    onSetValue: handleSetValue,
    onChange: handleChange,
    onValidate: settingsRef.current?.onValidate,
    onClose: handleClose,
  };

  const [showDialog, hideDialog] = useCustomModal({
    title: settingsRef.current?.title || "",
    Content: ModalDialog,
    contentProps: dialogProps,
    buttons: []
  }, [dialogProps]);

  const dialogController: IDialogController = useMemo(() => ({
    display: (settings: DisplayDialogSettings) => {
      settingsRef.current = settings;
      validateFieldValues();
      // prevents focus-bouncing between editor and dialog
      editor?.blur();
      showDialog();
    },
    update: (newValues: IFieldValues) => {
      setFieldValues(newValues);
      validateFieldValues();
    }
  }), [editor, showDialog]);

  return dialogController;
};
