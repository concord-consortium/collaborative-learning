import JSDOMEnvironment from "jest-environment-jsdom";
import type { EnvironmentContext, JestEnvironmentConfig } from "@jest/environment";

/**
 * Custom Jest environment that exposes jsdom's reconfigure method.
 * This is needed for Jest 30 where the traditional delete + assign
 * pattern no longer works for window.location. Use jsdom.reconfigure({ url: ... })
 * to change the URL in tests instead.
 *
 * Note: For mocking window.location.assign/replace/reload, mock at a different
 * level (e.g., the auth-utils module) since jsdom 25+ doesn't allow replacing
 * window.location directly.
 */
export default class CustomJSDOMEnvironment extends JSDOMEnvironment {
  constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
    super(config, context);

    // Expose jsdom helpers on the global object
    this.global.jsdom = {
      reconfigure: (options: { url?: string }) => {
        if (options.url) {
          this.dom?.reconfigure({ url: options.url });
        }
      },
    };
  }
}
