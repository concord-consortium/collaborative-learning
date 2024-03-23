import React, { useCallback, useRef, useState } from "react";
import { ClassicPreset } from "rete";
import { useStopEventPropagation } from "./custom-hooks";
import { NodePeriodUnits } from "../../model/utilities/node";
import { INumberNodeModel } from "../nodes/number-node";

// TODO: it seems like some controls hold state that needs to be serialized
// but there is all of the state here which doesn't need to be saved.
// TODO: where is the value of the number control actually saved??
export class NumberUnitsControl extends ClassicPreset.Control {
  value: number;
  currentUnits: string;

  // TODO: switch this to a set of options to make it more clear
  constructor(
    // Extract these two properties so they are generic
    // Also it would probably better to make a version of this control
    // which doesn't do anything with units
    public model: INumberNodeModel,
    public key: string,

    public readonly = false,
    public label = "",
    public initVal = 0,
    public minVal: number | null = null,
    public units: string[] | null = null,
    public tooltip = ""
  ) {
    super();
    // This is a place were serialization handling is required.
    // In the old code `node.data[..]` was how to access the serialized state.

    // In the old code it was doing
    // this.value = Number(node.data[key] || initVal)


    this.value = initVal;

    // It was doing:
    // this.currentUnits = node.data[unitsKey] || (units?.length ? units[0] : "")
    this.currentUnits = units?.length ? units[0] : "";

    // The value stored in `data` was a value with a fixed unit, I think it is seconds
    // This was then converted in the component to be in the unit specified
  }

  public setValue(val: number) {
    this.value = val;
  }

  public setCurrentUnits(val: string) {
    this.currentUnits = val;
  }

  public setValueFromUser(val: number) {
    // FIXME: this won't work if minVal is 0
    if (this.minVal && val < this.minVal) {
      val = this.minVal;
    }
    // FIXME: this needs to be handled in the component
    // this.props.inputValue = val;
    // this.props.value = val;
    //
    const periodUnits = NodePeriodUnits.find((u: any) => u.unit === this.currentUnits);
    const periodUnitsInSeconds = periodUnits ? periodUnits.lengthInSeconds : 1;
    this.setValue(val * periodUnitsInSeconds);

    // FIXME: this probably needs to be moved out to the component
    // You can see how this is needed if you set the value to something less than the
    // minimum
    // (this as any).update();

    // FIXME: need to handle dataflow log events maybe here or in component
    // dataflowLogEvent("numberinputmanualentry", this as Control, n.meta.inTileWithId as string);
  }

  public getValueForUser() {
    const periodUnits = NodePeriodUnits.find((u: any) => u.unit === this.currentUnits);
    const periodUnitsInSeconds = periodUnits ? periodUnits.lengthInSeconds : 1;
    return this.value / periodUnitsInSeconds;
  }
}

// TODO: where does inputValue and currentUnits come from???
//   these seem to the state values of the control instead of its configuration
export const NumberUnitsControlComponent: React.FC<{ data: NumberUnitsControl; }> = (props) => {
  // These vars are setup to minimize the changes to the code imported from
  // our Rete v1 implementation
  const compProps = props.data;
  const { label } = props.data;

  // TODO: the value stored in the control is in fixed units probably seconds
  // so this needs to be converted before being used as the default value for
  // the input.
  const [inputValue, setInputValue] = useState(compProps.getValueForUser());

  const handleChange = useCallback((e: any) => {
    setInputValue(e.target.value);
  }, []);

  const handleBlur = useCallback((e: any) => {
    const v = e.target.value;
    if (isFinite(v)) {
      compProps.setValueFromUser(Number(v));

      // FIXME: need to reprocess data and log the event
      // perhaps the logging could happen in the control instead of here
      // this.emitter.trigger("process");
      // const n = this.getNode();
      // dataflowLogEvent("numberinputmanualentry", this as Control, n.meta.inTileWithId as string);
    } else {
      // Restore the value to the one currently stored in the control
      setInputValue(compProps.getValueForUser());
    }
  }, [compProps]);

  const handleKeyPress = useCallback((e: any) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  }, []);

  const handleSelectChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    compProps.setCurrentUnits(event.target.value);

    // CHECKME: We can probably get by without storing the value both in the component and control
    // If the user has changed the value it will be blurred before they can change the units
    // So the inputValue should represent the most recent user value
    // And now that the currentUnits were just changed setting the inputValue will convert it
    // to seconds.
    // The problem might be that the blur hasn't triggered a re-render yet when the user then
    // changes the units. In this case the inputValue could be some kind of invalid value.
    // If this is a problem it could be fixed by figuring out the conversion based on the previous
    // units. That adjustment could be made in the control's "setCurrentUnits"
    compProps.setValueFromUser(inputValue);

    // TODO: need to trigger an update of the component since we aren't updating any state
    // and we aren't observing our model.
    // You can see this behavior just by trying to change the value, the component does
    // re-render but it shows the previous selection not the one you just selected.

    // (this as any).update();

    // TODO: need to trigger a data calculation
    // this.emitter.trigger("process");

    // TODO: how do we get our node in this new setup?
    // Perhaps it is passed in a sibling prop to 'data'
    // Or we can go from the control(data) up to the node.
    // const n = this.getNode();
    // dataflowLogEvent("unitdropdownselection", this as Control, n.meta.inTileWithId as string);
  }, [compProps, inputValue]);

  const inputRef = useRef<HTMLInputElement>(null);
  useStopEventPropagation(inputRef, "pointerdown");
  return (
    <div className="number-container" title={compProps.tooltip}>
      { label
        ? <label className="number-label">{compProps.label}</label>
        : null
      }
      <input className={`number-input ${compProps.units && compProps.units.length ? "units" : ""}`}
        ref={inputRef}
        type={"text"}
        value={inputValue}
        onKeyPress={handleKeyPress}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      { compProps.units?.length
        ? <div className="type-options-back">
            <div className="type-options">
              <select onChange={handleSelectChange}
                value={compProps.currentUnits}
              >
                { compProps.units.map((unit, index) => (
                    <option key={index} value={unit}>{unit}</option>
                  ))
                }
              </select>
            </div>
          </div>
        : null
      }
    </div>
  );
};
