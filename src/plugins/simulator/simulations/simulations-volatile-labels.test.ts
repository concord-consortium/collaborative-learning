import { Variable, VariableType } from "@concord-consortium/diagram-view";
import { kVolatileVariableLabel } from "../../shared-variables/variable-labels";
import { simulations } from "./simulations";

// Enforcement / forcing-function test for the producer-declared volatile marker.
//
// SharedVariables.exportStableSnapshot() drops the `value` of any variable marked
// kVolatileVariableLabel, so authoring previews stop reloading. Correctness therefore depends on
// every variable whose value a running simulation/program overwrites being marked. This test
// exercises each registered simulation exactly as the runtime does and asserts that any variable
// whose value actually changed carries the marker — so a future simulation that adds a driven
// variable without marking it fails here, loudly and locally, instead of silently reintroducing the
// preview-reload bug.
//
// It drives all three producer paths a running document exercises:
//   1. the simulator's `values` map (cycled inputs, e.g. brainwaves' panTemperature),
//   2. the simulation's own `step()` (computed sensors/intermediates, e.g. terrarium's rawTemperature),
//   3. a running dataflow program (live-output variables — simulated here by driving them directly).
// It intentionally does NOT assert the converse (marked => changed): a runtime-derived value that
// happens to be constant in a given run may still be legitimately marked.

const FRAMES = 300;

describe.each(Object.entries(simulations))("simulation '%s' volatile marks", (key, simulation) => {
  it("marks every variable whose value a running simulation/program overwrites", () => {
    const variables: VariableType[] = simulation.variables.map(v => Variable.create(v));
    const findByName = (name: string) => variables.find(v => v.name === name);
    const liveOutputs = variables.filter(v => v.hasLabelType("live-output"));

    const initialValue = new Map(variables.map(v => [v.id, v.value]));
    const changed = new Set<string>();
    const recordChanges = () =>
      variables.forEach(v => { if (v.value !== initialValue.get(v.id)) changed.add(v.id); });

    for (let frame = 0; frame < FRAMES; frame++) {
      // (3) simulate a running dataflow program driving the live-output variables
      liveOutputs.forEach(v => v.setValue((frame % 7) + 1));
      // (1) replicate SimulatorContentModel.step(): apply the simulation's values map
      for (const [name, values] of Object.entries(simulation.values)) {
        findByName(name)?.setValue(values[frame % values.length]);
      }
      // (2) run the simulation's own step function
      simulation.step?.({ frame, variables });
      recordChanges();
    }

    const changedButUnmarked = variables
      .filter(v => changed.has(v.id) && !v.hasLabel(kVolatileVariableLabel))
      .map(v => v.name);
    expect({ simulation: key, changedButUnmarked }).toEqual({ simulation: key, changedButUnmarked: [] });
  });
});
