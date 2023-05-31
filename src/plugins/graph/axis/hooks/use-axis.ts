import {ScaleBand, ScaleLinear, scaleLinear, scaleOrdinal} from "d3";
import {autorun, reaction} from "mobx";
import {MutableRefObject, useCallback, useEffect} from "react";
import {axisGap} from "../axis-types";
import {useAxisLayoutContext} from "../models/axis-layout-context";
import {IAxisModel, isNumericAxisModel} from "../models/axis-model";
import {graphPlaceToAttrRole} from "../../graph-types";
import {maxWidthOfStringsD3} from "../../utilities/graph-utils";
import {useDataConfigurationContext} from "../../hooks/use-data-configuration-context";
import {collisionExists, getStringBounds} from "../axis-utils";
import graphVars from "../../components/graph.scss";

export interface IUseAxis {
  // pass accessor rather than axis model itself to avoid stale closure/defunct object issues
  getAxisModel: () => IAxisModel | undefined
  axisElt: SVGGElement | null
  titleRef?: MutableRefObject<SVGGElement | null>
  axisTitle?: string
  centerCategoryLabels: boolean
}

export const useAxis = ({
                          getAxisModel, axisTitle = "",
                          centerCategoryLabels
                        }: IUseAxis) => {
  const layout = useAxisLayoutContext(),
    axisModel = getAxisModel(),
    isNumeric = axisModel && isNumericAxisModel(axisModel),
    place = axisModel?.place ?? 'bottom',
    multiScale = layout.getAxisMultiScale(place),
    ordinalScale = isNumeric || axisModel?.type === 'empty' ? null : multiScale?.scale as ScaleBand<string>;
  const
    dataConfiguration = useDataConfigurationContext(),
    axisPlace = axisModel?.place ?? 'bottom',
    attrRole = graphPlaceToAttrRole[axisPlace],
    type = axisModel?.type ?? 'empty',
    attributeID = dataConfiguration?.attributeID(attrRole);

  const computeDesiredExtent = useCallback(() => {
    if (dataConfiguration?.placeCanHaveZeroExtent(axisPlace)) {
      return 0;
    }
    const labelFont = graphVars.graphLabelFont,
      axisTitleHeight = getStringBounds(axisTitle, labelFont).height,
      numbersHeight = getStringBounds('0').height,
      repetitions = multiScale?.repetitions ?? 1,
      bandWidth = ((ordinalScale?.bandwidth?.()) ?? 0) / repetitions,
      categories = ordinalScale?.domain() ?? [],
      collision = collisionExists({bandWidth, categories, centerCategoryLabels}),
      maxLabelExtent = maxWidthOfStringsD3(dataConfiguration?.categorySetForAttrRole(attrRole) ?? []),
      d3Scale = multiScale?.scale ?? (type === 'numeric' ? scaleLinear() : scaleOrdinal());
    let desiredExtent = axisTitleHeight + 2 * axisGap;
    let ticks: string[] = [];
    switch (type) {
      case 'numeric': {
        const format = (d3Scale as ScaleLinear<number, number>).tickFormat?.();
        ticks = (((d3Scale as ScaleLinear<number, number>).ticks?.()) ?? []).map(tick => format(tick));
        desiredExtent += ['left', 'rightNumeric'].includes(axisPlace)
          ? Math.max(getStringBounds(ticks[0]).width, getStringBounds(ticks[ticks.length - 1]).width) + axisGap
          : numbersHeight + axisGap;
        break;
      }
      case 'categorical': {
        desiredExtent += collision ? maxLabelExtent : getStringBounds().height;
        break;
      }
    }
    return desiredExtent;
  }, [centerCategoryLabels, ordinalScale, axisPlace, attrRole, dataConfiguration, axisTitle, type, multiScale]);

  // update d3 scale and axis when scale type changes
  useEffect(() => {
    if (getAxisModel()) {
      const disposer = reaction(
        () => {
          const {place: aPlace, scale: scaleType} = getAxisModel() || {};
          return {place: aPlace, scaleType};
        },
        ({place: aPlace, scaleType}) => {
          aPlace && scaleType && layout.getAxisMultiScale(aPlace)?.setScaleType(scaleType);
        }
      );
      return () => disposer();
    }
  }, [getAxisModel, isNumeric, layout]);

  // update d3 scale and axis when axis domain changes
  useEffect(function installDomainSync() {
    if (getAxisModel()?.isNumeric) {
      const disposer = autorun(() => {
        const _axisModel = getAxisModel();
        if (_axisModel && isNumericAxisModel(_axisModel)) {
          multiScale?.setNumericDomain(_axisModel?.domain);
        }
        layout.setDesiredExtent(axisPlace, computeDesiredExtent());
      });
      return () => disposer();
    }
  }, [multiScale, axisPlace, layout, computeDesiredExtent, getAxisModel]);

  // update d3 scale and axis when layout/range changes
  useEffect(() => {
    const disposer = reaction(
      () => {
        return layout.getAxisLength(axisPlace);
      },
      () => {
        layout.setDesiredExtent(axisPlace, computeDesiredExtent());
      }
    );
    return () => disposer();
  }, [layout, axisPlace, computeDesiredExtent]);

  // Set desired extent when things change
  useEffect(() => {
    layout.setDesiredExtent(axisPlace, computeDesiredExtent());
  }, [computeDesiredExtent, axisPlace, attributeID, layout]);

  // Set desired extent when repetitions of my multiscale changes
  useEffect(() => {
    const disposer = reaction(
      () => {
        return layout.getAxisMultiScale(axisPlace)?.repetitions;
      },
      () => {
        layout.setDesiredExtent(axisPlace, computeDesiredExtent());
      }
    );
    return () => disposer();
  }, [computeDesiredExtent, axisPlace, layout]);

};
