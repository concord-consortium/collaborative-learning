import React, { useContext, useMemo } from "react";
import { AppConfigContext, IconComponent } from "../../app-config-context";
import { DocumentModelType } from "../../models/document/document";
import { CustomSelect, ICustomDropdownItem } from "../../clue/components/custom-select";

import "./document-file-menu.scss";

interface IProps {
  document: DocumentModelType;
  isOpenDisabled?: boolean;
  onOpenDocument?: (document: DocumentModelType) => void;
  isCopyDisabled?: boolean;
  onCopyDocument?: (document: DocumentModelType) => void;
  isDeleteDisabled?: boolean;
  onDeleteDocument?: (document: DocumentModelType) => void;
}

function idAndIcon(id: string, appIcons?: Record<string, IconComponent>) {
  const ItemIcon = appIcons?.[id];
  // not clear why we need to reset the viewBox
  const viewBox = (id === "icon-new-workspace") || (id === "icon-open-workspace") ? "0 0 32 32" : "0 0 24 24";
  return { id, itemIcon: ItemIcon && <ItemIcon viewBox={viewBox} /> };
}

export const DocumentFileMenu: React.FC<IProps> = props => {
  const { document,
          isOpenDisabled, onOpenDocument,
          isCopyDisabled, onCopyDocument,
          isDeleteDisabled, onDeleteDocument } = props;

  const { appIcons } = useContext(AppConfigContext);
  const TitleIcon = appIcons?.["icon-open-workspace"];
  // not clear why we need to reset the viewBox
  const titleIcon = TitleIcon && <TitleIcon viewBox="0 0 32 32" />;

  const menuItems: ICustomDropdownItem[] = useMemo(() => ([
    {
      ...idAndIcon("icon-open-workspace", appIcons),
      text: "Open...",
      disabled: !!isOpenDisabled,
      onClick: () => onOpenDocument?.(document)
    },
    {
      ...idAndIcon("icon-copy-workspace", appIcons),
      text: "Make a copy",
      disabled: !!isCopyDisabled,
      onClick: () => onCopyDocument?.(document)
    },
    {
      ...idAndIcon("icon-delete-workspace", appIcons),
      text: "Delete",
      disabled: !!isDeleteDisabled,
      onClick: () => onDeleteDocument?.(document)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [document]);

  return (
    <CustomSelect className="document-file-menu" dataTest="document-file-menu"
                  title="File" titleIcon={titleIcon}
                  items={menuItems} showItemChecks={false} showItemIcons={true}/>
  );
};
