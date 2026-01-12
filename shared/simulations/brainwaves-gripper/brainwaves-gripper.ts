import { demoStreams } from "../../assets/data/dataflow/demo-data";
import { ISimulationData } from "../simulation-types";

export const kBrainwavesKey = "EMG_and_claw";

const maxTemperature = Math.max(...demoStreams.fastBoil);

export const brainwavesGripperValues = {
  // Variable names
  gripperKey: {
    value: "gripper_key", description: "The name of the gripper variable, which is how closed the gripper is. "
      + "This variable can be set by an output node writing to the simulated gripper in a Dataflow program."
  },
  pressureKey: {
    value: "pressure_key",
    description: "The name of the pressure variable, which is the pressure sensed at the gripper tips. "
      + "This variable can be accessed with an input node reading from simulated pressure sensor in a Dataflow"
      + " program."
  },
  panTemperatureKey: { value: "pan_temperature_key", description: "The name of the actual pan temperature variable." },
  temperatureKey: {
    value: "temperature_key",
    description: "The name of the temperature variable, which is the temperature sensed at the gripper tips. "
      + "This variable can be accessed with an input node reading from simulated temperature sensor in a Dataflow"
      + " program."
  },
  targetEMGKey: {
    value: "target_emg_key",
    description: "The name of the target EMG variable, which is set by a slider the user can adjust."
  },
  emgKey: {
    value: "emg_key",
    description: "The name of the EMG variable, which is the target EMG minus a random amount on every frame to"
      + " simulate imperfect EMG data. "
      + "This variable can be accessed with an input node reading from simulated EMG in a Dataflow program."
  },
  simulationModeKey: { value: "simulation_mode_key", description: "The name of the simulation mode variable" },

  // Constants
  maxGripperValue: { value: 100, description: "The maximum value of the gripper variable" },
  minGripperCupValue: { value: 60, description: "The value of the gripper when it starts to feel the cup" },
  minGripperPanValue: { value: 81, description: "The value of the gripper when it starts to feel the pan" },
  maxPressure: { value: 300, description: "The pressure value when the gripper is fully closed" },
  baseTemperature: { value: 15.5, description: "The starting temperature of the pan, 60 degrees F" },
  maxTemperature: { value: maxTemperature, description: "The maximum temperature of the pan" },
  emgDropFactor: { value: .1, description: "The max percentage difference between the target EMG and actual EMG." },
  simulationModePressure: { value: 0, description: "The simulation mode for sensing pressure on a plastic cup" },
  simulationModeTemperature: { value: 1, description: "The simulation mode for sensing temperature on a pan" }
};

export const brainwavesGripperData: ISimulationData = {
  // eslint-disable-next-line max-len
  description: `This simulation shows a human arm with EMG sensors on it that can report whether the arm is flexed or not. The degree of flex on the arm is controlled between completely unflexed to flexed to 90 degrees. The EMG sensors are connected to simulated Arduino that can be programmed using a separate Dataflow tile. The Arduino programming can control the degree of opening or closing on a mechanical gripper. This simulation can be set to either measure the pressure in the tips of the gripper as it grips a plastic cup, or the temperature in the tips of the gripper as it closes on a pan on a stove.`,
  values: brainwavesGripperValues
};
