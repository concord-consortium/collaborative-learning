import { ISimulationData } from "../simulation-types";

export const kTerrariumKey = "terrarium";

export const stepDuration = 1000;

export const terrariumValues = {
  // Variable names
  rawTemperatureKey: {
    value: "raw_temperature_key",
    description: "The name of the raw temperature variable, which is used to determine the actual temperature."
  },
  temperatureKey: {
    value: "temperature_key",
    description: "The name of the temperature variable, which is the actual temperature in the terrarium." +
     " It is a random number between -.05 and +.05 added to the raw temperature."
  },
  humidityKey: {
    value: "humidity_key",
    description: "The name of the humidity variable, which is the current humidity in the terrarium."
  },
  fanKey: {
    value: "fan_key",
    description: "The name of the fan variable. 0 means the fan is off; anything else means it's on."
  },
  heatLampKey: {
    value: "heat_lamp_key",
    description: "The name of the heat lamp variable. 0 means the heat lamp is off; anything else means it's on."
  },
  humidifierKey: {
    value: "humidifier_key",
    description: "The name of the humidifier variable. 0 means the humidifier is off; anything else means it's on."
  },

  // Constants
  minTemperature: { value: 21, description: "The minimum temperature value for the terrarium in °C" },
  maxTemperature: { value: 27, description: "The maximum temperature value for the terrarium in °C" },
  minHumidity: { value: 0, description: "The minimum humidity value for the terrarium in %" },
  startHumidity: { value: 20, description: "The starting humidity value for the terrarium in %" },
  maxHumidity: { value: 90, description: "The maximum humidity value for the terrarium in %" },
  baseHumidityImpactPerStep: {
    value: -10 / 600000 * stepDuration,
    description: "The base change in humidity, -10% every 10 minutes"
  },
  fanHumidityImpactPerStep: {
    value: -5 / 60000 * stepDuration,
    description: "The impact on humidity when the fan is on, -5% every minute"
  },
  fanTemperatureImpactPerStep: {
    value: -1 / 60000 * stepDuration,
    description: "The impact on temperature when the fan is on, -1°C every minute"
  },
  heatLampTemperatureImpactPerStep: {
    value: 1 / 60000 * stepDuration,
    description: "The impact on temperature when the heat lamp is on, +1°C every minute"
  },
  humidifierHumidityImpactPerStep: {
    value: 15 / 60000 * stepDuration,
    description: "The impact on humidity when the humidifier is on, +15% every minute"
  },
  minGeckoHumidity: { value: 20, description: "The minimum humidity for the gecko to be active in %" },
  maxGeckoTemperature: { value: 25, description: "The maximum temperature for the gecko to be active in °C" }
};

export const terrariumData: ISimulationData = {
  // eslint-disable-next-line max-len
  description: `This simulation shows a gecko in a glass dome that has sensors to measure the temperature and humidity inside the dome. These virtual sensors are connected to a simulated Microbit that can be programmed using a separate Dataflow tile. There are three output devices that can be programmed to change conditions in the dome. A heat lamp can be turned on or off to create heat, a fan can be turned on or off to remove air from the dome, and a humidifier can be turned on or off to create moisture under the dome. The gecko becomes unwell and stops moving if the humidity gets too low or the temperature gets too high.`,
  values: terrariumValues
};
