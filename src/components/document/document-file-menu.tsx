import React, { useContext, useMemo } from "react";
import { AppConfigContext, IconComponent } from "../../app-config-context";
import { useAppMode, useStores } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";
import { CustomSelect, ICustomDropdownItem } from "../../clue/components/custom-select";
import { IStores } from "../../models/stores/stores";
import { usePublishDialog } from "./use-publish-dialog";

import "./document-file-menu.scss";

interface IProps {
  document: DocumentModelType;
  isOpenDisabled?: boolean;
  onOpenDocument?: (document: DocumentModelType) => void;
  onOpenGroupDocument?: (document: DocumentModelType) => void;
  isCopyDisabled?: boolean;
  onCopyDocument?: (document: DocumentModelType) => void;
  isDeleteDisabled?: boolean;
  onDeleteDocument?: (document: DocumentModelType) => void;
  onAdminDestroyDocument?: (document: DocumentModelType) => void;
}

function idAndIcon(id: string, appIcons?: Record<string, IconComponent>) {
  const ItemIcon = appIcons?.[id];
  // not clear why we need to reset the viewBox -- seems that icons are stored at different sizes
  const viewBox = ["icon-new-workspace", "icon-open-workspace", "icon-publish-workspace"].includes(id)
    ? "0 0 32 32"
    : "0 0 24 24";
  return { id, itemIcon: ItemIcon && <ItemIcon viewBox={viewBox} /> };
}

function showPublishOption(document: DocumentModelType, stores: IStores) {
  const { appConfig } = stores;
  if (!appConfig.disablePublish) return true;
  // disablePublish can be 'true', or a list of specs - document types and properties
  if (document.type === "planning" || appConfig.disablePublish === true) return false;
  return appConfig.disablePublish
          .findIndex(spec => {
            return stores.sectionDocuments.isMatchingSpec(document, spec.documentType, spec.properties);
          }) < 0;
}

export const DocumentFileMenu: React.FC<IProps> = props => {
  const { document,
          isOpenDisabled, onOpenDocument,
          onOpenGroupDocument,
          isCopyDisabled, onCopyDocument,
          isDeleteDisabled, onDeleteDocument,
          onAdminDestroyDocument } = props;

  const appMode = useAppMode();
  const { appIcons } = useContext(AppConfigContext);
  const stores = useStores();
  const [showPublishDialog] = usePublishDialog(document);
  const TitleIcon = appIcons?.["icon-open-workspace"];
  // not clear why we need to reset the viewBox
  const titleIcon = TitleIcon && <TitleIcon viewBox="0 0 32 32" />;
  const isCopyReallyDisabled = (isCopyDisabled || document.type === "planning");
  const adminDestroyDocumentItem: ICustomDropdownItem = {
    text: "[Dev] Destroy...",
    disabled: !onAdminDestroyDocument,
    onClick: () => onAdminDestroyDocument?.(document)
  };
  const adminItems = onAdminDestroyDocument && (appMode === "dev") ? [adminDestroyDocumentItem] : [];
  const { appConfig, user } = stores;
  const groupsPermitted = !appConfig.autoAssignStudentsToIndividualGroups;
  const showGroupDocOption = appConfig.groupDocumentsEnabled && groupsPermitted && !!user.currentGroupId;

  let publishOption: ICustomDropdownItem[] = [];
  if (showPublishOption(document, stores)) {
    publishOption = [
      {
        ...idAndIcon("icon-publish-workspace", appIcons),
        text: "Publish...",
        disabled: false,
        onClick: () => { showPublishDialog(); }
      }
    ];
  }

  let groupDocOption: ICustomDropdownItem[] = [];
  if (showGroupDocOption) {
    groupDocOption = [
      {
        ...idAndIcon("icon-open-group-doc", appIcons),
        text: "Group Doc",
        disabled: false,
        onClick: () => onOpenGroupDocument?.(document)
      }
    ];
  }

  const menuItems: ICustomDropdownItem[] = useMemo(() => ([
    {
      ...idAndIcon("icon-open-workspace", appIcons),
      text: "Open...",
      disabled: !!isOpenDisabled,
      onClick: () => onOpenDocument?.(document)
    },
    ...groupDocOption,
    ...publishOption,
    {
      ...idAndIcon("icon-copy-workspace", appIcons),
      text: "Make a copy",
      disabled: !!isCopyReallyDisabled,
      onClick: () => onCopyDocument?.(document)
    },
    {
      ...idAndIcon("icon-delete-workspace", appIcons),
      text: "Delete",
      disabled: !!isDeleteDisabled,
      onClick: () => onDeleteDocument?.(document)
    },
    ...adminItems
  ]), [document, adminItems, groupDocOption, publishOption]);

  return (
    <CustomSelect className="document-file-menu" dataTest="document-file-menu"
                  titleIcon={titleIcon} title="File" titleVisuallyHidden={true}
                  items={menuItems} showItemChecks={false} showItemIcons={true}/>
  );
};
