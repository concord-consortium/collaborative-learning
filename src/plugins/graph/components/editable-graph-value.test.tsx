import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditableGraphValue } from './editable-graph-value';
import { INumericAxisModel, NumericAxisModel } from '../imports/components/axis/models/axis-model';
import { AxisPlace } from '../imports/components/axis/axis-types';
import { AxisLayoutContext } from '../imports/components/axis/models/axis-layout-context';

const mockAxisLayout = {
  getAxisLength: jest.fn().mockReturnValue(100),
  setParentExtent: jest.fn(),
  getAxisBounds: jest.fn(),
  setAxisBounds: jest.fn(),
  getAxisMultiScale: jest.fn(),
  getAxisScale: jest.fn(),
  setAxisScaleType: jest.fn(),
  getComputedBounds: (place: AxisPlace) => {
    // Return a mock AxisBounds object
    return { left: 10, width: 100, top: 10, height: 100 };
  },
  setDesiredExtent: jest.fn()
};

interface TestWrapperProps {
  children: React.ReactNode;
}

const TestWrapper: React.FC<TestWrapperProps> = ({children}) => {
  return (
    <AxisLayoutContext.Provider value={mockAxisLayout}>
      {children}
    </AxisLayoutContext.Provider>
  );
};

//----------------------------------------------------------

//Clue story hour question
//It's not actually mutating the model by going through handleMinMaxChange (graph.tsx) -> setMin (axis-model.ts)
//Wouldn't we have to create a mock Graph (which is a parent of EditableGraphValue) - seems too complex.
// - Graph's props are
// interface IProps {
//   graphController: GraphController;
//   graphRef: MutableRefObject<HTMLDivElement | null>;
//   onRequestRowHeight?: (id: string, size: number) => void;
//   readOnly?: boolean
// }
//--------------------------------------------


describe('EditableGraphValue component', () => {
  let numericAxisModel: INumericAxisModel;
  let onValueChangeMock: jest.Mock<void, [number]>;

  beforeEach(()=>{
    numericAxisModel = NumericAxisModel.create({ place: "left", min: -10, max: 10 }) as INumericAxisModel;
    numericAxisModel.setDomain(-10, 10);
    onValueChangeMock = jest.fn();

    render(
      <TestWrapper>
        <EditableGraphValue
          value={numericAxisModel.min}
          axis={numericAxisModel.place}
          minOrMax={"min"}
          onValueChange={onValueChangeMock}
          readOnly={false}
        />
      </TestWrapper>
    );

  });

  //----Helper Functions----

  function editMinOrMaxValue(newValue: number, minOrMax: string) {
    //simulates clicking an editable-graph-value and entering  newvalue
    const editableBox = screen.getByTestId(`editable-border-box-left-${minOrMax}`);
    fireEvent.click(editableBox);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: newValue } }); // Simulate user changing the input value
    fireEvent.blur(input);
  }

  it('can edit the min', () => {
    editMinOrMaxValue(15, "min");
    expect(onValueChangeMock).toHaveBeenCalledWith(15);
  });

  it('can edit the min and update the min given a valid input', async () => {
    editMinOrMaxValue(-11, "min");
    await waitFor(() => {
      expect(numericAxisModel.min).toBe(-11);
    });
  });


  it('does not update to a new min value given an invalid input', () => {
    //Since original min is -10, if we enter a number thats greater than the max, we validate the input
    expect(onValueChangeMock).toHaveBeenCalledWith(15);
    expect(numericAxisModel.min).toBe(-10);
  });



});
