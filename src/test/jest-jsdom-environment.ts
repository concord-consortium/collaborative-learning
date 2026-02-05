import JSDOMEnvironment from "jest-environment-jsdom";
import type { EnvironmentContext, JestEnvironmentConfig } from "@jest/environment";

/**
 * Custom Jest environment that exposes jsdom's reconfigure method and
 * allows mocking of window.location methods.
 * This is needed for Jest 30 where the traditional delete + assign
 * pattern no longer works for window.location.
 */
export default class CustomJSDOMEnvironment extends JSDOMEnvironment {
  private originalLocation: Location | null = null;
  private locationMocked = false;

  constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
    super(config, context);

    // Expose jsdom helpers on the global object
    this.global.jsdom = {
      reconfigure: (options: { url?: string }) => {
        if (options.url) {
          this.dom?.reconfigure({ url: options.url });
        }
      },
      // Method to replace window.location with a mock object
      // Note: This is called from within test files, so `window` in the test
      // is the same as `this.global` in the environment.
      mockLocation: (mockLocation: Partial<Location>) => {
        // Access the global object (which is the window in jsdom)
        const globalWindow = this.global as unknown as Window;

        if (!this.locationMocked) {
          this.originalLocation = globalWindow.location;
          this.locationMocked = true;
        }

        // Create a mock location with all the original properties plus overrides
        // Note: tests should provide their own mock functions for assign/reload/replace
        const fullMock: Partial<Location> & { toString: () => string } = {
          href: this.originalLocation?.href || "",
          origin: this.originalLocation?.origin || "",
          protocol: this.originalLocation?.protocol || "",
          host: this.originalLocation?.host || "",
          hostname: this.originalLocation?.hostname || "",
          port: this.originalLocation?.port || "",
          pathname: this.originalLocation?.pathname || "/",
          search: this.originalLocation?.search || "",
          hash: this.originalLocation?.hash || "",
          ...mockLocation,
          toString: () => fullMock.href || "",
        };

        // In Jest 30/jsdom, window.location is not configurable, so we cannot
        // replace it. Tests that need to mock location should mock at a different
        // level (e.g., mock functions that use location, or mock the auth-utils module).
        // This method is kept for compatibility but may not work in all cases.
        try {
          // Try to delete and redefine - this works in some environments
          Reflect.deleteProperty(globalWindow, "location");
          Object.defineProperty(globalWindow, "location", {
            value: fullMock,
            writable: true,
            configurable: true,
          });
        } catch (e) {
          // If we can't redefine location, at least set the value
          // This may trigger navigation errors in jsdom
          console.warn("Could not mock window.location - jsdom does not allow it. " +
            "Consider mocking at a different level (e.g., auth-utils functions).");
        }
      },
      // Method to restore the original location
      restoreLocation: () => {
        if (this.locationMocked) {
          // We can't restore the original jsdom location directly.
          // Instead, we just mark it as not mocked and let jsdom handle it.
          // The next test will get a fresh jsdom environment anyway.
          this.locationMocked = false;
          // Reconfigure to the original URL if we saved it
          if (this.originalLocation) {
            this.dom?.reconfigure({ url: this.originalLocation.href });
          }
        }
      },
    };
  }
}
