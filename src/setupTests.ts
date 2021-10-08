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
(global as any).jestSpyConsole = (method: ConsoleMethod, fn: (spyFn: jest.SpyInstance) => void) => {
  // intercept and suppress console methods
  const mockConsoleFn = jest.spyOn(global.console, method).mockImplementation(() => null);

  // call the client's code
  fn(mockConsoleFn);

  // restore console behavior
  mockConsoleFn.mockRestore();
};

declare global {
  function jestSpyConsole(method: ConsoleMethod, fn: (spyFn: jest.SpyInstance) => void): void;
}
