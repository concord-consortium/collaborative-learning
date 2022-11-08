import { Variable } from "@concord-consortium/diagram-view";
import { render } from "@testing-library/react";
import { applySnapshot } from "mobx-state-tree";
import React from "react";
import { kEmptyVariable, VariableChip } from "./variable-chip";

describe("VariableChip", () => {
  it("renders all combinations", () => {
    const variable = Variable.create();
    const {container} = render(<VariableChip variable={variable}/>);
    expect(container).toHaveTextContent(kEmptyVariable);

    applySnapshot(variable, {id: variable.id, name: "some name"});
    expect(container).toHaveTextContent(/^some name$/);

    applySnapshot(variable, {id: variable.id, value: 1.234});
    expect(container).toHaveTextContent(/^1.234$/);

    applySnapshot(variable, {id: variable.id, unit: "m"});
    expect(container).toHaveTextContent(/^\(m\)$/);

    applySnapshot(variable, {id: variable.id, name: "some name", value: 1.234});
    expect(container).toHaveTextContent(/^some name=1.234$/);

    applySnapshot(variable, {id: variable.id, name: "some name", unit: "m"});
    expect(container).toHaveTextContent(/^some name\(m\)$/);

    applySnapshot(variable, {id: variable.id, value: 1.234, unit: "m" });
    expect(container).toHaveTextContent(/^1.234m$/);

    applySnapshot(variable, {id: variable.id, name: "some name", value: 1.234, unit: "m" });
    expect(container).toHaveTextContent(/^some name=1.234m$/);

  });
});
