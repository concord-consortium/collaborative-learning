import {ScaleBand, ScaleLinear, scaleLinear, scaleOrdinal} from "d3";
import {reaction} from "mobx";
import {MutableRefObject, useCallback, useEffect, useRef} from "react";
import { mstAutorun } from "../../../../../../utilities/mst-autorun";
import {axisGap} from "../axis-types";
import {useAxisLayoutContext} from "../models/axis-layout-context";
import {IAxisModel, isNumericAxisModel} from "../models/axis-model";
import {
  graphPlaceToAttrRole, kAxisLabelVerticalPadding, kAxisTickLength, kAxisTickPadding
} from "../../../../graph-types";
import {maxWidthOfStringsD3} from "../../../../utilities/graph-utils";
import {useDataConfigurationContext} from "../../../../hooks/use-data-configuration-context";
import {collisionExists, getStringBounds} from "../axis-utils";
import graphVars from "../../../../components/graph.scss";
import { isImageUrl } from "../../../../../../models/data/data-types";

export interface IUseAxis {
  axisModel?: IAxisModel
  axisElt: SVGGElement | null
  titleRef?: MutableRefObject<SVGGElement | null>
  axisTitle?: string
  centerCategoryLabels: boolean
}

export const useAxis = ({
                          axisModel, axisTitle = "",
                          centerCategoryLabels
                        }: IUseAxis) => {
  const layout = useAxisLayoutContext(),
    isNumeric = axisModel && isNumericAxisModel(axisModel),
    place = axisModel?.place ?? 'bottom',
    multiScale = layout.getAxisMultiScale(place),
    ordinalScale = isNumeric || axisModel?.type === 'empty' ? null : multiScale?.scale as ScaleBand<string>,
    // eslint-disable-next-line react-hooks/exhaustive-deps  --  see note below
    categories = ordinalScale?.domain() ?? [];
  const
    // By all rights, the following three lines should not be necessary to get installDomainSync to run when
    // GraphController:processV2Document installs a new axis model.
    // Todo: Revisit and figure out whether we can remove the workaround.
    previousAxisModel = useRef<IAxisModel>(),
    axisModelChanged = previousAxisModel.current !== axisModel,
    dataConfiguration = useDataConfigurationContext(),
    axisPlace = axisModel?.place ?? 'bottom',
    attrRole = graphPlaceToAttrRole[axisPlace],
    type = axisModel?.type ?? 'empty',
    attributeID = dataConfiguration?.attributeID(attrRole);
  previousAxisModel.current = axisModel;

  /** Todo: from Kirk
   * Looking at the overall format of this code, the computeDesiredExtent() callback lists almost everything that
   * could possibly change as a dependency, meaning that a new callback will be generated after nearly every change.
   * Then there are four useEffects whose primary purpose is to call computeDesiredExtent(), meaning that nearly every
   * change will result in four calls to something like:
   *         layout.setDesiredExtent(axisPlace, computeDesiredExtent())
   * Seems like a situation where a single autorun or possibly reaction would make more sense. Another approach
   * might be to introduce something like an AxisViewModel which could encapsulate some of these computations
   * analogous to the way the CollectionTableModel is a MobX class which encapsulates a number of table-related
   * computations. Then the desiredExtent could be a computed property which is cached automatically.
   */
  const computeDesiredExtent = useCallback(() => {
    if (dataConfiguration?.placeCanHaveZeroExtent(axisPlace)) {
      return 0;
    }
    const labelFont = graphVars.graphLabelFont,
      axisTitleHeight = getStringBounds(axisTitle, labelFont).height,
      numbersHeight = getStringBounds('0').height,
      repetitions = multiScale?.repetitions ?? 1,
      bandWidth = ((ordinalScale?.bandwidth?.()) ?? 0) / repetitions,
      collision = collisionExists({bandWidth, categories, centerCategoryLabels}),
      categoryArrayValues = dataConfiguration?.categoryArrayForAttrRole(attrRole),
      // Image URLs will be replaced with the placeholder "<image>", so do not measure the URL values
      validCategoryArrayValues = categoryArrayValues?.map(cat => isImageUrl(cat) ? "<image>" : cat),
      maxLabelExtent = maxWidthOfStringsD3(validCategoryArrayValues ?? []),
      d3Scale = multiScale?.scale ?? (type === 'numeric' ? scaleLinear() : scaleOrdinal());
    let desiredExtent =
      axisTitleHeight + 2 * (axisGap + kAxisLabelVerticalPadding) + kAxisTickLength + kAxisTickPadding;
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
  }, [dataConfiguration, axisPlace, axisTitle, multiScale?.repetitions, multiScale?.scale,
    ordinalScale, categories, centerCategoryLabels, attrRole, type]);

  // update d3 scale and axis when scale type changes
  useEffect(() => {
    if (axisModel) {
      const disposer = reaction(
        () => {
          const {place: aPlace, scale: scaleType} = axisModel;
          return {place: aPlace, scaleType};
        },
        ({place: aPlace, scaleType}) => {
          layout.getAxisMultiScale(aPlace)?.setScaleType(scaleType);
        }
      );
      return () => disposer();
    }
  }, [isNumeric, axisModel, layout]);

  // update d3 scale and axis when axis domain changes
  useEffect(function installDomainSync() {
    if (isNumeric) {
      return mstAutorun(() => {
        axisModel.domain && multiScale?.setNumericDomain(axisModel.domain);
        layout.setDesiredExtent(axisPlace, computeDesiredExtent());
      }, { name: "useAxis.installDomainSync" }, axisModel);
    }
    // Note axisModelChanged as a dependent. Shouldn't be necessary.
  }, [axisModelChanged, isNumeric, axisModel, multiScale,
    axisPlace, layout, computeDesiredExtent]);

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
  }, [axisModel, layout, axisPlace, computeDesiredExtent]);

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
