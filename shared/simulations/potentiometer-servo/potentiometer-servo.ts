import { ISimulationData } from "../simulation-types";

export const kPotentiometerServoKey = "potentiometer_chip_servo";

export const potentiometerAndServoValues = {
  // Variable names
  potAngleKey: {
    value: "pot_angle_key",
    description: "The name of the potentiometer variable, which represents the angle of the potentiometer."
  },
  resistReadingKey: {
    value: "resist_reading_key",
    description: "The name of the resistance reading variable, which is proportional to the potentiometer angle. "
      + "This variable can be accessed with an input node reading from the simululated pin in a Dataflow program."
  },
  servoAngleKey: {
    value: "servo_angle_key",
    description: "The name of the servo angle variable, which represents the angle of the servo arm. "
      + "This variable can be set by an output node writing to the simulated servo in a Dataflow program."
  },

  // Constants
  minPotAngle: { value: 0, description: "The minimum angle of the potentiometer in degrees" },
  maxPotAngle: { value: 270, description: "The maximum angle of the potentiometer in degrees. 10-bit ADC" },
  minResistReading: { value: 0, description: "The minimum resistance reading from the potentiometer" },
  maxResistReading: { value: 1023, description: "The maximum resistance reading from the potentiometer" },
  minServoAngle: { value: 0, description: "The minimum angle of the servo in degrees" },
  maxServoAngle: { value: 180, description: "The maximum angle of the servo in degrees" }
};

export const potentiometerAndServoData: ISimulationData = {
  // eslint-disable-next-line max-len
  description: `This simulation shows an Arduino microprocessor with inputs for battery power (Voltage) or a digital sensor such as a potentiometer dial, and outputs such as a connection to a servo which can have its angle set. The value of the potentiometer can be set via a slider. At its minimum value, it points to the bottom left, rotating clockwise to reach the bottom right at maximum value. At its minimum value, the servo points left, and it rotates counterclockwise to point right at maximum value. As the simulated Arduino is programmed in a separate Dataflow tile, the instructions in the program are shown overlapping the Arduino to associate the electric microcircuits with the functions they perform.`,
  values: potentiometerAndServoValues
};
