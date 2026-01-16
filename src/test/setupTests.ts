import "@testing-library/jest-dom";
import { enableFetchMocks } from "jest-fetch-mock";
import { TextEncoder, TextDecoder } from "util";

// make fetch mocking available in all tests
enableFetchMocks();

/*
 * jestSpyConsole
 *
 * Utility function for mocking/suppressing console messages during tests
 *
 * Usage:

  it("suppresses console messages while capturing calls", () => {
    jestSpyConsole("warn", spy => {
      // doesn't log to console
      console.warn("Warning!");
      // but does capture calls to console
      expect(spy).toHaveBeenCalled();
    });
  });

  The return value is a promise which can be awaited which is useful with async functions.

  it("suppresses console messages while capturing calls", () => {
    await jestSpyConsole("warn", spy => {
      // doesn't log to console
      console.warn("Warning!");
      // but does capture calls to console
      expect(spy).toHaveBeenCalled();
    });
  });

  Specify { noRestore: true } to have the client take responsibility for handling cleanup:

  it("suppresses console messages while capturing calls", () => {
    const consoleSpy = jestSpyConsole("warn", spy => {
      // doesn't log to console
      console.warn("Warning!");
      // but does capture calls to console
      expect(spy).toHaveBeenCalled();
    });
    ...
    (await consoleSpy).mockRestore();
  });

 */
type ConsoleMethod = "log" | "warn" | "error";
type JestSpyConsoleFn = (spy: jest.SpyInstance) => void;
interface IJestSpyConsoleOptions {
  // if true, client is responsible for calling mockRestore on the returned instance
  noRestore?: boolean;
  // whether to log messages to the console
  show?: boolean | ((...args: any[]) => boolean);
}
declare global {
  // eslint-disable-next-line max-len
  function jestSpyConsole(method: ConsoleMethod, fn: JestSpyConsoleFn, options?: IJestSpyConsoleOptions): Promise<jest.SpyInstance>;

  /**
   * Use this helper to make sure a variable is defined and not null.
   *
   * Jest's `expect(value).toBeDefined()` does not tell Typescript that the variable
   * is guaranteed to be defined afterward. By using assertIsDefined Typescript will
   * know the variable is defined and not null. The not null check is included
   * because the only way I found to do this is using Typescript's NonNullable<T>.
   *
   * This is based on this:
   * https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions
   *
   * Perhaps in the future Jest will support these assertions:
   * https://github.com/DefinitelyTyped/DefinitelyTyped/issues/41179
   *
   * @param value value to make sure it is defined
   */
  function assertIsDefined<T>(value: T): asserts value is NonNullable<T>;
}
(global as any).jestSpyConsole = async (method: ConsoleMethod, fn: JestSpyConsoleFn,
    options?: IJestSpyConsoleOptions) => {
  // intercept and suppress console methods
  const consoleMethodSpy = jest.spyOn(global.console, method).mockImplementation((...args: any[]) => {
    if ((typeof options?.show === "boolean" && options.show) ||
        (typeof options?.show === "function" && options.show(...args))) {
      // output logs that match the filter (generally for debugging)
      console.debug(...args); // eslint-disable-line no-console
    }
  });

  // call the client's code
  await Promise.resolve(fn(consoleMethodSpy));

  // return the spy instance if client doesn't want us to restore it for them
  if (options?.noRestore) {
    return consoleMethodSpy;
  }

  // restore the original console method (unless client indicates they will)
  consoleMethodSpy.mockRestore();

  // cast so typescript doesn't complain about legitimate usage
  // using the mock after restore will still generate an error at runtime
  return undefined as any as typeof consoleMethodSpy;
};

(global as any).assertIsDefined = (value: unknown) => {
  // Look 1 stack frame up for the real problem
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
};

// required for ResizeObserver called in mathlive
global.ResizeObserver = require('resize-observer-polyfill');

// Polyfill TextEncoder/TextDecoder for jsdom environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;
