import {select} from "d3";
import React, {useEffect} from "react";
import {tip as d3tip} from "d3-v6-tip";
import {IGraphModel} from "../models/graph-model";
import {IDotsRef, transitionDuration} from "../graph-types";
import {getPointTipText} from "../utilities/graph-utils";
import {RoleAttrIDPair} from "../models/data-configuration-model";
import { CaseData } from "../d3-types";

const dataTip = d3tip().attr('class', 'graph-d3-tip')/*.attr('opacity', 0.8)*/
  .attr('data-testid', 'graph-point-data-tip')
  .html((d: string) => {
    return `<p>${d}</p>`;
  });

interface IUseDataTips {
  dotsRef: IDotsRef,
  graphModel: IGraphModel,
  enableAnimation: React.MutableRefObject<boolean>
}
export const useDataTips = ({dotsRef, graphModel, enableAnimation}: IUseDataTips) => {
  const hoverPointRadius = graphModel.getPointRadius('hover-drag'),
    pointRadius = graphModel.getPointRadius(),
    selectedPointRadius = graphModel.getPointRadius('select'),
    roleAttrIDPairs:RoleAttrIDPair[] = graphModel.uniqueTipAttributes;

  useEffect(() => {

    function okToTransition(target: any) {
      return !enableAnimation.current && target.node()?.nodeName === 'circle'
        && graphModel.layers[0].isLinked
        && !target.property('isDragging');
    }

    function showDataTip(event: MouseEvent) {
      const target = select(event.target as SVGSVGElement);
      if (okToTransition(target)) {
        target.transition().duration(transitionDuration).attr('r', hoverPointRadius);
        const { dataConfigID, plotNum, caseID } = (target.datum() as CaseData),
          attrIDsToUse = roleAttrIDPairs.filter((aPair) => {
            return plotNum > 0 || aPair.role !== 'rightNumeric';
          }).map((aPair) => {
            return plotNum === 0
              ? aPair.attributeID
              : aPair.role === 'y'
                ? graphModel.getDataConfiguration(dataConfigID)?.yAttributeIDs[plotNum]
                : aPair.attributeID;
          });
        const tipText = getPointTipText(caseID, attrIDsToUse, graphModel);
        tipText !== '' && dataTip.show(tipText, event.target);
      }
    }

    function hideDataTip(event: MouseEvent) {
      const target = select(event.target as SVGSVGElement);
      dataTip.hide();
      if (okToTransition(target)) {
        const { dataConfigID, caseID } = (select(event.target as SVGSVGElement).datum() as CaseData),
          isSelected = graphModel.getDataConfiguration(dataConfigID)?.dataset?.isCaseSelected(caseID);
        select(event.target as SVGSVGElement)
          .transition().duration(transitionDuration)
          .attr('r', isSelected ? selectedPointRadius : pointRadius);
      }
    }

    dotsRef.current && select(dotsRef.current)
      .on('mouseover', showDataTip)
      .on('mouseout', hideDataTip)
      .call(dataTip);
  }, [dotsRef, enableAnimation, roleAttrIDPairs, hoverPointRadius, pointRadius, selectedPointRadius, graphModel]);
};
