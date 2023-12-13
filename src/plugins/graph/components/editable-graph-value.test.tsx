import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableGraphValue } from './editable-graph-value';
import { INumericAxisModel, NumericAxisModel } from '../imports/components/axis/models/axis-model';
import { AxisPlace } from '../imports/components/axis/axis-types';
import { AxisLayoutContext } from '../imports/components/axis/models/axis-layout-context';

const mockAxisLayout = {
  setParentExtent: jest.fn(),
  getAxisLength: jest.fn().mockReturnValue(100),
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




describe('EditableGraphValue component', () => {
  let numericAxisModel: INumericAxisModel;
  let onValueChangeMock: jest.Mock<void, [number]>;

  it('renders the component',() => {
    // Assuming AxisModel.create can be mocked to return an object with min, max, and setMin/setMax functions
    numericAxisModel = NumericAxisModel.create({ place: "left", min: -10, max: 10 }) as INumericAxisModel;
    numericAxisModel.setDomain(-10, 10);
    onValueChangeMock = jest.fn();

    // Mocking the context or other hooks might be necessary depending on how EditableGraphValue accesses the model
    // For example, if it uses a context, you will need to mock the context provider

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

  // it('updates to a new valid min value', () => {
  //   numericAxisModel.setMin(-20);
  //   expect(numericAxisModel.min).toBe(-20);
  // });

  it('can edit the min', () => {
     // Trigger editing mode if needed


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

     const editableBox = screen.getByTestId('editable-border-box-left-min');
     fireEvent.click(editableBox);

     // Find the input element, assuming it becomes visible after clicking the box
     const input = screen.getByRole('textbox'); // Adjust this if the input has a specific role or test id

     // Simulate user changing the input value
     fireEvent.change(input, { target: { value: '15' } });
     fireEvent.blur(input); // If onBlur is used to trigger updates

     // Verify that the value has changed
     expect(onValueChangeMock).toHaveBeenCalledWith(15);
  });

  // it('does not update to a new valid min value', () => {
  //   numericAxisModel.setMin(15); //since max is 10 it should not update
  //   expect(numericAxisModel.min).toBe(-10);
  // });


});
