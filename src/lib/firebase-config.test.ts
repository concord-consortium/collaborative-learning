export {}; // isolatedModules compatibility

const getConfigWithEnv = (env: string | undefined) => {
  jest.resetModules();
  jest.doMock("../utilities/url-params", () => ({
    urlParams: { firebaseEnv: env }
  }));

  return require("./firebase-config").firebaseConfig();
};

describe("firebaseConfig", () => {
  afterEach(() => {
    jest.resetModules();
  });

  it("returns the correct config for production by default", () => {
    const config = getConfigWithEnv(undefined);
    expect(config.apiKey).toBeDefined();
    expect(config.authDomain).toBe("collaborative-learning-ec215.firebaseapp.com");
    expect(config.databaseURL).toBe("https://collaborative-learning-ec215.firebaseio.com");
    expect(config.projectId).toBe("collaborative-learning-ec215");
  });

  it("returns the correct config for production when specified by URL param", () => {
    const config = getConfigWithEnv("production");
    expect(config.apiKey).toBeDefined();
    expect(config.authDomain).toBe("collaborative-learning-ec215.firebaseapp.com");
    expect(config.databaseURL).toBe("https://collaborative-learning-ec215.firebaseio.com");
    expect(config.projectId).toBe("collaborative-learning-ec215");
  });

  it("returns the correct config for staging when specified by URL param", () => {
    const config = getConfigWithEnv("staging");
    expect(config.apiKey).toBeDefined();
    expect(config.authDomain).toBe("collaborative-learning-staging.firebaseapp.com");
    expect(config.databaseURL).toBe("https://collaborative-learning-staging-default-rtdb.firebaseio.com");
    expect(config.projectId).toBe("collaborative-learning-staging");
  });
});
