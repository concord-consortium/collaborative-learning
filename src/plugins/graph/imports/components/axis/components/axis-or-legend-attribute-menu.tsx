import { Menu, MenuItem, MenuList, MenuButton, MenuDivider, Portal } from "@chakra-ui/react";
import React, { CSSProperties, useRef, useEffect, useState } from "react";
import t from "../../../utilities/translation/translate";
import {GraphPlace} from "../../axis-graph-shared";
import { graphPlaceToAttrRole } from "../../../../graph-types";
import { useDataSetContext } from "../../../hooks/use-data-set-context";
import { IUseDraggableAttribute, useDraggableAttribute } from "../../../hooks/use-drag-drop";
import { useInstanceIdContext } from "../../../hooks/use-instance-id-context";
import { useOutsidePointerDown } from "../../../hooks/use-outside-pointer-down";
import { useOverlayBounds } from "../../../hooks/use-overlay-bounds";
import { AttributeType } from "../../../../../../models/data/attribute";
import { IDataSet } from "../../../../../../models/data/data-set";
import { isSetAttributeNameAction } from "../../../../../../models/data/data-set-actions";
import { IGraphLayerModel } from "../../../../models/graph-layer-model";

interface IProps {
  place: GraphPlace;
  layer: IGraphLayerModel;
  attributeId?: string;
  // element to be mirrored
  target: SVGGElement | HTMLElement | null;
  // element to be used for positioning/portal-ing the button that triggers the menu
  parent: HTMLElement | null;
  // element to be used for portal-ing the popup menu list
  portal: HTMLElement | null;
  onChangeAttribute: (place: GraphPlace, dataSet: IDataSet, attrId: string, oldAttrId?: string) => void;
  onRemoveAttribute: (place: GraphPlace, attrId: string) => void;
  onTreatAttributeAs: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void;
  onOpenClose?: (isOpen: boolean) => void;
}

const removeAttrItemLabelKeys: Record<string, string> = {
  "x": "DG.DataDisplayMenu.removeAttribute_x",
  "y": "DG.DataDisplayMenu.removeAttribute_y",
  "rightNumeric": "DG.DataDisplayMenu.removeAttribute_y2",
  "legend": "DG.DataDisplayMenu.removeAttribute_legend",
  "topSplit": "DG.DataDisplayMenu.removeAttribute_top",
  "rightSplit": "DG.DataDisplayMenu.removeAttribute_right"
};

export const AxisOrLegendAttributeMenu = ({ place, layer, attributeId, target, parent, portal, onOpenClose,
                                      onChangeAttribute, onRemoveAttribute, onTreatAttributeAs }: IProps) => {
  const data = useDataSetContext();
  const dataConfig = layer.config;
  const yAttributesPlotted = dataConfig.yAttributeDescriptions.map((a)=>a.attributeID);

  const role = graphPlaceToAttrRole[place];
  const attrId = attributeId || dataConfig?.attributeID(role) || '';
  const instanceId = useInstanceIdContext();
  const attribute = attrId ? data?.attrFromID(attrId) : null;
  const [labelText, setLabelText] = useState(attribute?.name);
  const removeAttrItemLabel = t(removeAttrItemLabelKeys[role], {vars: [attribute?.name]});
  const treatAs = dataConfig?.attributeType(role) === "numeric" ? "categorical" : "numeric";
  const parentRef = useRef(parent);
  parentRef.current = parent;
  const portalRef = useRef(portal);
  portalRef.current = portal;
  const menuListRef = useRef<HTMLDivElement>(null);
  const showRemoveOption = true; // Used to be a setting; for now we always want it available.

  const onCloseRef = useRef<() => void>();
  const overlayStyle: CSSProperties = {
    position: "absolute", ...useOverlayBounds({target, portal: parent})
  };
  const buttonStyle: CSSProperties = {
    position: "absolute", inset: 0, padding: 0, color: "transparent"
  };

  const draggableOptions: IUseDraggableAttribute = {
    prefix: instanceId, dataSet: data, attributeId: attrId
  };
  const { attributes, listeners, setNodeRef: setDragNodeRef } = useDraggableAttribute(draggableOptions);

  useOutsidePointerDown({ref: menuListRef, handler: () => onCloseRef.current?.()});

  useEffect(() => {
    dataConfig?.onAction(action => {
      if (isSetAttributeNameAction(action)) {
        data?.attributes?.map((attr) => {
          if (attr.id === attrId) {
            setLabelText(attr.name);
          }
        });
      }
    });
  }, [attribute?.name, data?.attributes, dataConfig, labelText, setLabelText, attrId]);

  return (
    <div className={`axis-legend-attribute-menu ${place}`} >
      <Menu boundary="scrollParent">
        {({ onClose, isOpen }) => {
          onOpenClose && onOpenClose(isOpen);
          onCloseRef.current = onClose;
          return (
            <Portal containerRef={parentRef}>
              <div ref={setDragNodeRef} style={overlayStyle} {...attributes} {...listeners}>
                <MenuButton style={buttonStyle}>{attribute?.name}</MenuButton>
                <Portal containerRef={portalRef}>
                  <MenuList ref={menuListRef}>
                    { !data &&
                      <MenuItem className="inactive">
                        Link Data
                      </MenuItem>
                    }
                    { data?.attributes?.map((attr) => {
                      const isCurrent = attr.id === attrId;
                      const isPlottedX = dataConfig?.attributeID("x") === attr.id;
                      const isPlottedY = yAttributesPlotted?.includes(attr.id);
                      const showAttr = (!isCurrent && !isPlottedX && !isPlottedY);

                      return showAttr && (
                        <MenuItem onClick={() => onChangeAttribute(place, data, attr.id, attrId)} key={attr.id}>
                          {attr.name}
                        </MenuItem>
                      );
                    })}
                    { attribute &&
                      <>
                        <MenuDivider />
                        { showRemoveOption &&
                          <MenuItem onClick={() => onRemoveAttribute(place, attrId)}>
                          {removeAttrItemLabel}
                          </MenuItem>
                        }
                        <MenuItem onClick={() => onTreatAttributeAs(place, attribute?.id, treatAs)}>
                          {treatAs === "categorical" && t("DG.DataDisplayMenu.treatAsCategorical")}
                          {treatAs === "numeric" && t("DG.DataDisplayMenu.treatAsNumeric")}
                        </MenuItem>
                      </>
                    }
                  </MenuList>
                </Portal>
              </div>
            </Portal>
          );
        }}
      </Menu>
    </div>
  );
};
