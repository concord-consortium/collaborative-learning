import { Variable, VariableType } from "@concord-consortium/diagram-view";
import { simulations } from "./simulations/simulations";

// Acceptance guard for CLUE-616: a free-running simulation must emit NO
// tile-change events. Logging lives only in the student control handlers
// (buttons / slider release), never in the simulation loop — this test drives
// the loop the way SimulatorContentModel.step() does (apply the values map,
// then the simulation's own step()) for many frames and asserts nothing logs.
// If a future change routes logging through a step()/setValue path, this fails.

const mockLogTileChangeEvent = jest.fn();
jest.mock("../../models/tiles/log/log-tile-change-event", () => ({
  logTileChangeEvent: (...args: any[]) => mockLogTileChangeEvent(...args)
}));

const FRAMES = 100;

describe("simulation loop logging", () => {
  beforeEach(() => mockLogTileChangeEvent.mockReset());

  describe.each(Object.entries(simulations))("simulation '%s'", (_key, simulation) => {
    it("emits no tile-change events while free-running", () => {
      const variables: VariableType[] = simulation.variables.map(v => Variable.create(v));
      const findByName = (name: string) => variables.find(v => v.name === name);

      for (let frame = 0; frame < FRAMES; frame++) {
        // Replicate SimulatorContentModel.step(): apply the cycled values map...
        for (const [name, values] of Object.entries(simulation.values)) {
          findByName(name)?.setValue(values[frame % values.length]);
        }
        // ...then run the simulation's own step function.
        simulation.step?.({ frame, variables });
      }

      expect(mockLogTileChangeEvent).not.toHaveBeenCalled();
    });
  });
});
