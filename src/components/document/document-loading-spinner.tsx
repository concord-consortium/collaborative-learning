import React from "react";
import { useQueryClient } from "react-query";
import { DocumentModelType } from "../../models/document/document";
import "./document-loading-spinner.scss";

interface IProps {
  document?: DocumentModelType;
}
export const DocumentLoadingSpinner: React.FC<IProps> = ({ document }) => {
  const queryClient = useQueryClient();
  return document?.isRemote && document.isLoadingContent(queryClient)
          ? <div className="document-loading-spinner" data-testid="document-loading-spinner"/>
          : null;
};
