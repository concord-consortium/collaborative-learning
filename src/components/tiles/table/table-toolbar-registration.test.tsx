import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { ITableToolbarContext, TableToolbarContext } from "./table-toolbar-context";
import { SetExpressionButton } from "./table-toolbar-registration";

// The column header's expression row is the other way into the formula dialog, and a derived
// column no longer draws one. This button reaches it from the selected column instead, so it has
// to agree: to the student that column is data, with no expression to look at or change.
describe("SetExpressionButton", () => {
  function renderButton(canSetExpression: boolean) {
    const showExpressionsDialog = jest.fn();
    const context: ITableToolbarContext = {
      canSetExpression,
      showExpressionsDialog,
      deleteSelected: jest.fn(),
      importData: jest.fn(),
      uploadImage: jest.fn()
    };
    render(
      <TableToolbarContext.Provider value={context}>
        <SetExpressionButton name="set-expression" />
      </TableToolbarContext.Provider>
    );
    return { button: screen.getByRole("button", { name: "Set expression" }), showExpressionsDialog };
  }

  it("is enabled for an ordinary column", () => {
    const { button, showExpressionsDialog } = renderButton(true);

    expect(button).not.toHaveAttribute("aria-disabled");
    fireEvent.click(button);
    expect(showExpressionsDialog).toHaveBeenCalled();
  });

  it("is disabled when the selected column is one the owning tile derives", () => {
    const { button, showExpressionsDialog } = renderButton(false);

    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(showExpressionsDialog).not.toHaveBeenCalled();
  });

  it("says why it is disabled rather than the generic message", () => {
    const { button } = renderButton(false);

    fireEvent.click(button);

    expect(screen.getByText("This column is calculated for you")).toBeInTheDocument();
  });
});
