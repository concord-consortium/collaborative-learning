import { autorun, configure, observable, transaction } from "mobx";

describe("mobx", () => {
  /**
   * This is not used by our code currently, so if this test fails it is fine
   * to just update the test to document the behavior.
   */
  describe("scheduler", () => {
    beforeEach(() => {
      configure({enforceActions: "never"});
    });
    afterEach(() => {
      configure({enforceActions: "observed"});
    });
    it("is called once by a transaction", () => {
      let called = 0;
      const log: string[] = [];
      const value = observable.box("0");
      autorun(() => {
        log.push(value.get());
      }, {scheduler: run => {
        called++;
        run();
      }});

      // The autorun is called immediately
      expect(called).toBe(1);
      expect(log).toEqual(["0"]);

      // clear the tracking variables
      called = 0;
      log.length = 0;

      // Without a transaction
      value.set("1");
      value.set("2");
      expect(called).toBe(2);
      expect(log).toEqual(["1", "2"]);

      // clear the tracking variables
      called = 0;
      log.length = 0;

      transaction(() => {
        value.set("1");
        value.set("2");
      });
      expect(called).toBe(1);
      expect(log).toEqual(["2"]);
    });

    it("can pause reactions", async () => {
      let called = 0;
      const log: string[] = [];
      const pausedRuns: (() => void)[] = [];
      const value = observable.box("0");
      let paused = false;
      autorun(() => {
        log.push(value.get());
      }, {scheduler: run => {
        called++;
        if (paused) {
          pausedRuns.push(run);
        } else {
          run();
        }
      }});

      // The autorun is called immediately
      expect(called).toBe(1);
      expect(log).toEqual(["0"]);

      // clear the tracking variables
      called = 0;
      log.length = 0;

      paused = true;
      value.set("1");
      expect(called).toBe(1);
      expect(log).toEqual([]);

      paused = false;
      value.set("2");
      // Because we didn't call `run` our scheduler is not called again. This is not
      // documented by MobX. It does make sense that MobX would track that
      // there is an "in progress" scheduler and then just ignore future updates.
      expect(called).toBe(1);
      expect(log).toEqual([]);
      expect(pausedRuns.length).toBe(1);

      // Now we call the paused run
      pausedRuns[0]();
      pausedRuns.length = 0;

      // When it runs, the autorun function gets the current value, not the one from
      // when the scheduler was blocked
      expect(log).toEqual(["2"]);

      // Give MobX some time to see if it calls the scheduler that was skipped before
      await new Promise(resolve => setTimeout(resolve, 50));

      // Even with this break, the scheduler is not called to make up for one that
      // was skipped before.
      expect(called).toBe(1);
    });
  });

});
