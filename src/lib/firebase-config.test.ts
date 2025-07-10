export {}; // isolatedModules compatibility

const getConfigWithEnv = (env?: string) => {
  jest.resetModules();
  jest.doMock("../utilities/url-params", () => ({
    urlParams: { firebaseEnv: env }
  }));

  return require("./firebase-config").firebaseConfig();
};

const prodAuthDomain = "collaborative-learning-ec215.firebaseapp.com";
const prodDatabaseURL = "https://collaborative-learning-ec215.firebaseio.com";
const prodProjectId = "collaborative-learning-ec215";
const stagingAuthDomain = "collaborative-learning-staging.firebaseapp.com";
const stagingDatabaseURL = "https://collaborative-learning-staging-default-rtdb.firebaseio.com";
const stagingProjectId = "collaborative-learning-staging";

describe("firebaseConfig", () => {
  afterEach(() => {
    jest.resetModules();
  });

  it("returns the correct config for production by default", () => {
    const config = getConfigWithEnv();
    expect(config.apiKey).toBeDefined();
    expect(config.authDomain).toBe(prodAuthDomain);
    expect(config.databaseURL).toBe(prodDatabaseURL);
    expect(config.projectId).toBe(prodProjectId);
  });

  it("returns the correct config for production when specified by URL param", () => {
    const config = getConfigWithEnv("production");
    expect(config.apiKey).toBeDefined();
    expect(config.authDomain).toBe(prodAuthDomain);
    expect(config.databaseURL).toBe(prodDatabaseURL);
    expect(config.projectId).toBe(prodProjectId);
  });

  it("returns the correct config for staging when specified by URL param", () => {
    const config = getConfigWithEnv("staging");
    expect(config.apiKey).toBeDefined();
    expect(config.authDomain).toBe(stagingAuthDomain);
    expect(config.databaseURL).toBe(stagingDatabaseURL);
    expect(config.projectId).toBe(stagingProjectId);
  });

  it("returns the correct config for production when an unrecognized value is provided", () => {
    const config = getConfigWithEnv("does-not-exist");
    expect(config.apiKey).toBeDefined();
    expect(config.authDomain).toBe(prodAuthDomain);
    expect(config.databaseURL).toBe(prodDatabaseURL);
    expect(config.projectId).toBe(prodProjectId);
  });
});
