import React, { useEffect } from "react";
import { useSingleStringDialog } from "./use-single-string-dialog";

interface IProps {
  parentId?: string;
  onAccept: (content: string, parentId?: string) => void;
  onClose: () => void;
  content?: string;
  title?: string;
  prompt?: string;
  placeholder?: string;
  maxLength?: number;
}

// Component wrapper for useSingleStringDialog() for use by class components.
const SingleStringDialog: React.FC<IProps> = ({
  parentId, title, prompt, placeholder, content, maxLength, onAccept, onClose
}) => {

  const [showDialog, hideDialog] = useSingleStringDialog({
    title: title || "",
    prompt,
    placeholder,
    value: content,
    maxLength,
    context: parentId,
    onAccept,
    onClose
  });

  useEffect(() => {
    showDialog();
    return () => hideDialog();
  }, [hideDialog, showDialog]);

  return null;
};
export default SingleStringDialog;
