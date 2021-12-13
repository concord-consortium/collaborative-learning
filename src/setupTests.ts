import "@testing-library/jest-dom";
import { enableFetchMocks } from "jest-fetch-mock";
// make fetch mocking available in all tests
enableFetchMocks();

/*
 * jestSpyConsole
 *
 * Utility function for mocking/suppressing console messages during tests
 *
 * Usage:

  it("suppresses console messages while capturing calls", () => {
    jestSpyConsole("warn", mockConsoleFn => {
      // doesn't log to console
      console.warn("Warning!");
      // but does capture calls to console
      expect(mockConsoleFn).toHaveBeenCalled();
    });
  });

 */
type ConsoleMethod = "log" | "warn" | "error";
type JestSpyConsoleFn = (spyFn: jest.SpyInstance, mockRestore: () => void) => void;
interface IJestSpyConsoleOptions {
  asyncRestore?: boolean;
}
(global as any).jestSpyConsole = (method: ConsoleMethod, fn: JestSpyConsoleFn, options?: IJestSpyConsoleOptions) => {
  // intercept and suppress console methods
  const mockConsoleFn = jest.spyOn(global.console, method).mockImplementation(() => null);

  // call the client's code
  fn(mockConsoleFn, () => mockConsoleFn.mockRestore());

  // restore console behavior
  !options?.asyncRestore && mockConsoleFn.mockRestore();
};

declare global {
  function jestSpyConsole(method: ConsoleMethod, fn: JestSpyConsoleFn, options?: IJestSpyConsoleOptions): void;
}
