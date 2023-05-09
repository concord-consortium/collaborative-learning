import { Menu, MenuItem, MenuList, MenuButton, MenuDivider } from "@chakra-ui/react";
import React, { CSSProperties, useRef, memo, useEffect, useState } from "react";
import t from "../../utilities/translation/translate";
import {GraphPlace} from "../../axis-graph-shared";
import { graphPlaceToAttrRole } from "../../graph-types";
import { useDataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { useDataSetContext } from "../../hooks/use-data-set-context";
import { useOutsidePointerDown } from "../../hooks/use-outside-pointer-down";
import { useOverlayBounds } from "../../hooks/use-overlay-bounds";
import { AttributeType } from "../../../../models/data/attribute";
import { isSetNameAction } from "../../../../models/data/data-set-actions";

interface IProps {
  place: GraphPlace,
  target: SVGGElement | null
  portal: HTMLElement | null
  onChangeAttribute: (place: GraphPlace, attrId: string) => void
  onRemoveAttribute: (place: GraphPlace, attrId: string) => void
  onTreatAttributeAs: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void
}

const removeAttrItemLabelKeys: Record<string, string> = {
  "x": "DG.DataDisplayMenu.removeAttribute_x",
  "y": "DG.DataDisplayMenu.removeAttribute_y",
  "rightNumeric": "DG.DataDisplayMenu.removeAttribute_y2",
  "legend": "DG.DataDisplayMenu.removeAttribute_legend",
  "topSplit": "DG.DataDisplayMenu.removeAttribute_top",
  "rightSplit": "DG.DataDisplayMenu.removeAttribute_right"
};

const _AxisOrLegendAttributeMenu = ({ place, target, portal,
                                      onChangeAttribute, onRemoveAttribute, onTreatAttributeAs }: IProps) => {
  const data = useDataSetContext();
  const dataConfig = useDataConfigurationContext();
  const role = graphPlaceToAttrRole[place];
  const attrId = dataConfig?.attributeID(role) || '';
  const attribute = attrId ? data?.attrFromID(attrId) : null;
  const [labelText, setLabelText] = useState(attribute?.name);
  const removeAttrItemLabel = t(removeAttrItemLabelKeys[role], {vars: [attribute?.name]});
  const treatAs = dataConfig?.attributeType(role) === "numeric" ? "categorical" : "numeric";
  const overlayBounds = useOverlayBounds({target, portal});
  const buttonStyles: CSSProperties = { position: "absolute", color: "transparent" };
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef<() => void>();

  useOutsidePointerDown({ref: menuRef, handler: () => onCloseRef.current?.()});

  useEffect(() => {
    dataConfig?.onAction(action => {
      if (isSetNameAction(action)) {
        data?.attributes?.map((attr) => {
          if (attr.id === attrId) {
            setLabelText(attr.name);
          }
        });
      }
    });
  }, [attribute?.name, data?.attributes, dataConfig, labelText, setLabelText, attrId]);

  return (
    <div className={`axis-legend-attribute-menu ${place}`} ref={menuRef}>
      <Menu>
        {({ onClose }) => {
          onCloseRef.current = onClose;
          return (
            <>
              <MenuButton style={{ ...overlayBounds, ...buttonStyles }}>
                {labelText}
              </MenuButton>
              <MenuList>
                { !data &&
                  <MenuItem className="inactive">
                    Link Data
                  </MenuItem>
                }
                { data?.attributes?.map((attr) => {
                  return (
                    <MenuItem onClick={() => onChangeAttribute(place, attr.id)} key={attr.id}>
                      {attr.name}
                    </MenuItem>
                  );
                })}
                { attribute &&
                  <>
                    <MenuDivider />
                    <MenuItem onClick={() => onRemoveAttribute(place, attrId)}>
                      {removeAttrItemLabel}
                    </MenuItem>
                    <MenuItem onClick={() => onTreatAttributeAs(place, attribute?.id, treatAs)}>
                      {treatAs === "categorical" && t("DG.DataDisplayMenu.treatAsCategorical")}
                      {treatAs === "numeric" && t("DG.DataDisplayMenu.treatAsNumeric")}
                    </MenuItem>
                  </>
                }
              </MenuList>
            </>
          );
        }}
      </Menu>
    </div>
  );
};
export const AxisOrLegendAttributeMenu = memo(_AxisOrLegendAttributeMenu);
