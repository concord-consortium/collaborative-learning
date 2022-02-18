// `allMeasures` includes all the measures packaged with this library
import configureMeasurements, { allMeasures, AllMeasuresUnits } from "convert-units";

const convert = configureMeasurements(allMeasures);

type ConversionFunction = (input: number) => number;

export const getDimension = (unit:string) => {
    const foundUnit = convert().getUnit(unit as AllMeasuresUnits);
    return foundUnit?.measure;
};


export const getUnitConversion = (inputUnit:string, outputUnit:string): ConversionFunction | null => {
  
  if (inputUnit === outputUnit) {
      return value => value;
  }

  // First check if we can actual do this conversion
  // the "convert-units" only handles this by throwing an exception 
  // so instead we get the dimension of each unit to see if they are compatible.
  const inputDimension = getDimension(inputUnit);
  const outputDimension = getDimension(outputUnit);
  if (!inputDimension || !outputDimension) {
      return null;
  }

  if (inputDimension !== outputDimension) {
      return null;
  }
 
  return value => convert(value).from(inputUnit as AllMeasuresUnits).to(outputUnit as AllMeasuresUnits);
};
