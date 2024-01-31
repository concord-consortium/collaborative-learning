import { useMemo } from 'react';
import classNames from 'classnames';

interface AttributeClassNamesProps {
  attrKey: string;
  textLinesNeeded: number;
  editingLabel: boolean;
  attributeSelected: boolean;
  isLinked: boolean;
  looksLikeDefaultLabel: (label: string) => boolean;
  getLabel: () => string;
  editingValue: boolean;
  valueStr: string;
  gImageMap: { isImageUrl: (url: string) => boolean };
  valueHighlighted: boolean;
  isOpen: boolean;
  validCompletions: (aValues: string[], userString: string) => string[];
  currEditAttrId: string;
}

export function useAttributeClassNames({
  attrKey,
  textLinesNeeded,
  editingLabel,
  attributeSelected,
  isLinked,
  looksLikeDefaultLabel,
  getLabel,
  editingValue,
  valueStr,
  gImageMap,
  valueHighlighted,
  isOpen,
  validCompletions,
  currEditAttrId
}: AttributeClassNamesProps) {
  return useMemo(() => {
    return {
      pairClasses: classNames("case-attribute pair", attrKey,
        {
          "one-line": textLinesNeeded < 2,
          "two-lines": textLinesNeeded === 2,
          "three-lines": textLinesNeeded === 3,
          "four-lines": textLinesNeeded === 4,
          "five-lines": textLinesNeeded > 4
        }
      ),
      nameAreaClasses: classNames(
        "name-area", attrKey,
        { editing: editingLabel, highlighted: attributeSelected, linked: isLinked }
      ),
      nameInputClasses: classNames(
        "name-input",
        { highlighted: attributeSelected, linked: isLinked }
      ),
      nameTextClasses: classNames(
        "name-text",
        { "default-label": looksLikeDefaultLabel(getLabel()) }
      ),
      valueAreaClasses: classNames(
        "value-area", attrKey,
        {
          editing: editingValue,
          "has-image": gImageMap.isImageUrl(valueStr),
          highlighted: valueHighlighted,
          linked: isLinked
        }
      ),
      buttonsAreaClasses: classNames(
        "buttons-area",
        { highlighted: valueHighlighted, linked: isLinked }
      ),
      valueInputClasses: classNames(
        "value-input", attrKey,
        { highlighted: valueHighlighted, linked: isLinked }
      ),
      dropdownClasses: classNames(
        "dropdown",
        {
          open: isOpen,
          closed: !isOpen,
          empty: validCompletions.length === 0,
          "top-one": textLinesNeeded < 2,
          "top-two": textLinesNeeded === 2,
          "top-three": textLinesNeeded === 3,
          "top-four": textLinesNeeded === 4,
          "top-five": textLinesNeeded > 4
        }
      ),
      typeIconClasses: classNames(
        "type-icon", attrKey,
        { highlighted: valueHighlighted, linked: isLinked }
      ),
      deleteAttrClasses: classNames(
        `delete-attribute ${attrKey}`,
        { "show": currEditAttrId === attrKey }
      )
    };
  }, [attrKey,
    textLinesNeeded,
    editingLabel,
    attributeSelected,
    isLinked,
    looksLikeDefaultLabel,
    getLabel,
    editingValue,
    valueStr,
    gImageMap,
    valueHighlighted,
    isOpen,
    validCompletions,
    currEditAttrId
  ]
  );
}
