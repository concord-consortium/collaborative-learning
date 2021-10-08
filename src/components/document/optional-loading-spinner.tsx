import React from "react";
import { useQueryClient } from "react-query";
import { DocumentModelType } from "../../models/document/document";
import "./optional-loading-spinner.scss";

interface IProps {
  document?: DocumentModelType;
}
export const OptionalLoadingSpinner: React.FC<IProps> = ({ document }) => {
  const queryClient = useQueryClient();
  return document?.isRemote && document.isLoadingContent(queryClient)
          ? <div className="optional-loading-spinner"/>
          : null;
};
