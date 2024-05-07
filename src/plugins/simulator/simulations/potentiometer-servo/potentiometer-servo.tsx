import React, { useEffect, useRef } from "react";
import classNames from "classnames";
import { useResizeDetector } from "react-resize-detector";
import { VariableSlider } from "@concord-consortium/diagram-view";

import { ISimulation, ISimulationProps } from "../simulation-types";
import { iconUrl, kPotentiometerKey, kServoKey, kSignalKey
} from "../../../shared-assets/icons/icon-utilities";
import { findVariable } from "../simulation-utilities";
import {
  IMiniNodeData, getMiniNodeIcon, getMiniNodesDisplayData, getTweenedServoAngle, wireToA1, getNodeBoundingBox
} from "./chip-sim-utils";
import { useTileModelContext } from "../../../../components/tiles/hooks/use-tile-model-context";
import { useCanvasMethodsContext } from "../../../../components/document/canvas-methods-context";

import potDial from "./assets/pot-top.png";
import servoArm from "./assets/servo-arm.png";
import assemblyExpanded from "./assets/assembly-expanded.png";
import stopwatch from "./assets/stopwatch.png";

import "./potentiometer-servo.scss";

export const kPotentiometerServoKey = "potentiometer_chip_servo";

const potVisibleOffset = 135;
const servoVisibleOffset = 90;
const minPotAngle = 0;
const maxPotAngle = 270;
const minServoAngle = 0;
const minResistReading = 0;
const maxResistReading = 675; // our wired assembly sends 3.3V to pot, so max reading is 675

const kPotAngleKey = "pot_angle_key";
const kResistReadingKey = "resist_reading_key";
const kServoAngleKey = "servo_angle_key";

const miniNodeClasses = (node: IMiniNodeData, index:number, length:number) => {
  return classNames(
    'mini-node',
    { 'first': index === 0 },
    { 'last': index === length - 1 },
    `category-${node.category}`,
    `type-${node.type}`,
    `node-${node.id}`
  );
};

const MiniNode = ({ miniNode, index, length }:
    { miniNode: IMiniNodeData, index: number, length: number }) => {
  const { tile } = useTileModelContext();
  const canvasMethods = useCanvasMethodsContext();

  // Remove cached location when unmounted
  useEffect(() => {
    return () => {
      if (tile?.id) {
        canvasMethods?.cacheObjectBoundingBox(tile.id, miniNode.id, undefined);
      }
    };
  }, [canvasMethods, miniNode.id, tile]);

  return (
    <div key={miniNode.id} className={miniNodeClasses(miniNode, index, length)}>
      <div className="node-info">
        <div className="node-icon">{getMiniNodeIcon(miniNode.iconKey)}</div>
        <div className="node-label">{miniNode.label}</div>
      </div>
      <div className="node-value">
        {miniNode.value}
      </div>
    </div>
  );
};

const NodeColumn = ({ nodes, columnLabel }:
  { nodes: IMiniNodeData[], columnLabel: string }) => {
  const catLabel = columnLabel.charAt(0).toUpperCase() + columnLabel.slice(1);

  return (
    <div className={`mini-nodes-col ${columnLabel}`}>
      { nodes.map((miniNode, index) =>
        <MiniNode key={miniNode.id} miniNode={miniNode} index={index} length={nodes.length}/>)
      }
      <div className="category-label">{catLabel}</div>
    </div>
  );
};

function PotentiometerAndServoComponent({ tileElt, simRef, frame, variables, programData }: ISimulationProps) {
  const { tile } = useTileModelContext();
  const canvasMethods = useCanvasMethodsContext();
  const { height: resizeHeight, width: resizeWidth } = useResizeDetector({ targetRef: simRef });

  const tweenedServoAngle = useRef(0);
  const lastTweenedAngle = tweenedServoAngle.current;

  const potAngleVar = findVariable(kPotAngleKey, variables);
  const potAngleBaseValue = potAngleVar?.currentValue ?? 0;
  const visiblePotAngle = potAngleBaseValue - potVisibleOffset;
  const potRotationString = `rotate(${visiblePotAngle ?? 0}deg)`;

  const servoAngleVar = findVariable(kServoAngleKey, variables);
  const servoAngleBaseValue = servoAngleVar?.currentValue ?? 0;
  tweenedServoAngle.current = getTweenedServoAngle(servoAngleBaseValue, lastTweenedAngle);
  const valueForRotation = 180 - (tweenedServoAngle.current - servoVisibleOffset);
  const servoRotationString = `rotate(${valueForRotation}deg)`;

  const potServoClasses = classNames('pot-servo-component');
  const boardClasses = classNames('board');

  const miniNodesDataPack = getMiniNodesDisplayData(programData);
  const { inputNodesArr, operatorNodesArr, outputNodesArr, extraCount } = miniNodesDataPack;

  const hasPinIn = inputNodesArr.some(node => node.label.includes("Pin"));
  const hasOutToServo = outputNodesArr.some(node => node.label.includes("Servo"));
  const animationRate = programData?.samplingRate ? programData.samplingRate : 0;

  const nodeCount =  programData ? programData.programNodes.size : 0;

  // Recalculate and cache the locations of the individual nodes' div elements:
  // (a) When the component is rendered, (b) when the node count changes, and (c) when the tile changes size
  useEffect(() => {
    if (!tileElt || !tile) return;
    console.log('useEffect', resizeWidth, resizeHeight);
    const nodes = programData ? [...programData.programNodes.keys()] : [];
    for (const nodeId of nodes) {
      const bb = getNodeBoundingBox(nodeId, tileElt);
      if (!bb || bb.left === 0) {
        canvasMethods?.cacheObjectBoundingBox(tile?.id, nodeId, undefined);
      } else {
        canvasMethods?.cacheObjectBoundingBox(tile?.id, nodeId, bb);
      }
    }
  }, [tile, tileElt, canvasMethods, programData, nodeCount, resizeHeight, resizeWidth]);

  return (
    <div className={potServoClasses}>
      <div className="hardware">
          <div className="heading-area">
            <div className="sample-rate">
              <img className="stopwatch" src={stopwatch} style={{animationDuration: `${animationRate}ms`}} />
              { programData?.samplingRateStr }
            </div>
            <div className="arduino-label">Microprocessor</div>
            { extraCount > 0 && (
              <div className="hidden-nodes-count">+{extraCount} more</div>
            )}
          </div>
          <img
            className="pot-dial"
            src={potDial}
            style={{ transform: potRotationString }}
            alt="Potentiometer Dial"
          />
          { hasPinIn &&
            <>
              { wireToA1() }
              <div className="connected-pin input"></div>
            </>
          }
          <img
            src={assemblyExpanded}
            className={boardClasses}
            alt="Board"
          />

          <div className={"mini-nodes-column-wrapper"}>
            <NodeColumn nodes={inputNodesArr} columnLabel="inputs" />
            <NodeColumn nodes={operatorNodesArr} columnLabel="operators" />
            <NodeColumn nodes={outputNodesArr} columnLabel="outputs" />
          </div>

          { hasOutToServo &&
            <>
              <div className="connected-pin output"></div>
              <div className="output wire bg"></div>
              <div className="output wire"></div>
            </>
          }
          <img
            className="servo-arm"
            src={servoArm}
            style={{ transform: servoRotationString }}
            alt="Servo Arm"
          />
      </div>
      <div className="controls">
        <div className="slider area">
          <div className="slider-wrapper">
            <VariableSlider
              className="pot-slider"
              max={maxPotAngle}
              min={minPotAngle}
              step={5}
              variable={potAngleVar}
            />
            <div className="slider-labels">
              <div className="low">low</div>
              <div className="high">high</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function step({ frame, variables }: ISimulationProps) {
  // calculate resistance based on potentiometer angle
  const potAngleVar = findVariable(kPotAngleKey, variables);
  const potAngle = potAngleVar?.currentValue || 0;
  const resistance = Math.round((potAngle / maxPotAngle) * maxResistReading);
  const resistanceVar = findVariable(kResistReadingKey, variables);
  resistanceVar?.setValue(resistance);
}

export const potentiometerAndServoSimulation: ISimulation = {
  component: PotentiometerAndServoComponent,
  delay: 67, // between steps
  step,
  variables: [
    {
      displayName: "Potentiometer",
      labels: ["input", "position", "decimalPlaces:0"],
      icon: iconUrl(kPotentiometerKey),
      name: kPotAngleKey,
      value: minPotAngle,
      unit: "deg"
    },
    {
      displayName: "Pin",
      labels: ["input", "reading", "sensor:pin-reading", "decimalPlaces:0"],
      icon: iconUrl(kSignalKey),
      name: kResistReadingKey,
      value: minResistReading
    },
    {
      displayName: "Servo",
      labels: ["output", "position", "live-output:Servo", "decimalPlaces:0"],
      icon: iconUrl(kServoKey),
      name: kServoAngleKey,
      value: minServoAngle,
      unit: "deg"
    }
  ],
  values: {}
};
