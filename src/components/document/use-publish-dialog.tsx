import React from "react";
import PublishSvg from "../../assets/icons/publish/publish-icon-default.svg";
import { useCustomModal } from "../../hooks/use-custom-modal";
import { useDBStore, useProblemPath, useStores, useUIStore, useUserStore } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { translate } from "../../utilities/translation/translate";

import "./publish-dialog.scss";

export const usePublishDialog = (document: DocumentModelType) => {
  const stores = useStores();
  const user = useUserStore();
  const db = useDBStore();
  const problemPath = useProblemPath();
  const ui = useUIStore();
  const docTypeString = document.getLabel(stores.appConfig, 1);
  const docTypeStringL = document.getLabel(stores.appConfig, 1, true);

  const getProblemBaseTitle = (problemTitle: string) => {
    const match = /[\d.]*[\s]*(.+)/.exec(problemTitle);
    return match?.[1] || problemTitle;
  };

    const getSupportDocumentBaseCaption = () => {
    return document.type === ProblemDocument
            ? getProblemBaseTitle(stores.problem.title)
            : document.title;
  };
  const handlePublishSupport = () => {
    const caption = getSupportDocumentBaseCaption() || "Untitled";
    // TODO: Disable publish button while publishing
    db.publishDocumentAsSupport(document, caption)
      .then(() => {
        const classes = user.classHashesForProblemPath(problemPath);
        const classWord = classes.length === 1 ? "class" : "classes";
        ui.alert(`Your support was published to ${classes.length} ${classWord}.`, "Support Published");
      })
      .catch((reason) => ui.alert(`Your support failed to publish: ${reason}`, "Error"));
  };

  const handlePublishDocument = () => {
      const dbPublishDocumentFunc = document.type === ProblemDocument
                                      ? () => db.publishProblemDocument(document)
                                      : () => db.publishOtherDocument(document);
      dbPublishDocumentFunc()
        .then(() => ui.alert(`Your ${docTypeStringL} was published.`, `${docTypeString} Published`))
        .catch((reason) => ui.alert(`Your document failed to publish: ${reason}`, "Error"));
  };

  const title = document.type === "problem" ? `Publish Problem ${translate("Workspace")}`
                                            : document.type === "learningLog"
                                                ? `Publish Learning Log`
                                                : `Publish ${translate("Workspace")}`;

  const TextContent = () => {
    const content = user.type === "teacher"
                      ? "Do you want to publish to just this class or to all your classes?"
                      : `Do you want to publish your ${docTypeStringL}?`;
    return <p>{content}</p>;
  };

  const buttons = user.type === "teacher"
                    ? [
                        { label: "Cancel" },
                        { label: "This Class", isDefault: true, onClick: handlePublishDocument },
                        { label: "All Classes", onClick: handlePublishSupport }
                      ]
                    : [
                        { label: "Cancel" },
                        { label: "OK", isDefault: true, onClick: handlePublishDocument }
                      ];

  const [showPublishDialog, hidePublishDialog] = useCustomModal({
    className: "publish-dialog",
    title,
    Icon: PublishSvg,
    Content: TextContent,
    contentProps: {},
    buttons,
  }, [title, TextContent, buttons]);
  return [showPublishDialog, hidePublishDialog];
};
