import { demoStreams } from "../../assets/data/dataflow/demo-data";
import { ISimulationData } from "../simulation-types";

const maxPressure = 300;
const maxGripperValue = 100;

const minGripperCupValue = 60;
const gripperCupRange = maxGripperValue - minGripperCupValue;

export const kTemperatureKey = "temperature_key";

export const kGripperKey = "gripper_key";
export const kPressureKey = "pressure_key";
const kPanTemperatureKey = "pan_temperature_key";
const kSimulationModeKey = "simulation_mode_key";
const kTargetEMGKey = "target_emg_key";
export const kEMGKey = "emg_key";
const emgDropFactor = .1;

const kSimulationModePressure = 0;
const kSimulationModeTemperature = 1;
const baseTemperature = 15.5;
const maxTemperature = Math.max(...demoStreams.fastBoil);
const minGripperPanValue = 81;
const gripperPanRange = maxGripperValue - minGripperPanValue;

export const brainwavesGripperData: ISimulationData = {
  // eslint-disable-next-line max-len
  description: `This simulation shows a human arm with EMG sensors on it that can report whether the arm is flexed or not. The degree of flex on the arm is controlled between completely unflexed to flexed to 90 degrees. The EMG sensors are connected to simulated Arduino that can be programmed using a separate Dataflow tile. The Arduino programming can control the degree of opening or closing on a mechanical gripper. This simulation can be set to either measure the pressure in the tips of the gripper as it grips a plastic cup, or the temperature in the tips of the gripper as it closes on a pan on a stove.`,
  values: {
    maxPressure,
    maxGripperValue,
    minGripperCupValue,
    gripperCupRange,
    kEMGKey,
    kGripperKey,
    kPressureKey,
    kPanTemperatureKey,
    kTemperatureKey,
    kSimulationModeKey,
    kTargetEMGKey,
    emgDropFactor,
    kSimulationModePressure,
    kSimulationModeTemperature,
    baseTemperature,
    maxTemperature,
    minGripperPanValue,
    gripperPanRange
  },
  valueDescriptions: {
    maxPressure: "The pressure value when the gripper is fully closed",
    maxGripperValue: "The maximum value of the gripper variable",
    minGripperCupValue: "The value of the gripper when it starts to feel the cup",
    gripperCupRange: "The number of gripper values between feeling the cup and fully closed",
    kGripperKey: "The name of the gripper variable, which is how closed the gripper is",
    kPressureKey: "The name of the pressure variable, which is the pressure sensed at the gripper tips",
    kPanTemperatureKey: "The name of the actual pan temperature variable",
    kTemperatureKey: "The name of the temperature variable, which is the temperature sensed at the gripper tips",
    kSimulationModeKey: "The name of the simulation mode variable",
    kTargetEMGKey: "The name of the target EMG variable, which is set by a slider the user can adjust",
    kEMGKey: "The name of the EMG variable, which is the target EMG minus a random amount on every frame to simulate" +
      " imperfect EMG data",
    emgDropFactor: "Percentage drops for simulated emg signal",
    kSimulationModePressure: "The simulation mode for sensing pressure on a plastic cup",
    kSimulationModeTemperature: "The simulation mode for sensing temperature on a pan",
    baseTemperature: "The starting temperature of the pan, 60 degrees F",
    maxTemperature: "The maximum temperature of the pan",
    minGripperPanValue: "The value of the gripper when it starts to feel the pan",
    gripperPanRange: "The number of gripper values between feeling the pan and fully closed"
  }
};
