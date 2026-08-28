export {}; // isolatedModules compatibility

const getConfigWithEnv = (env?: string) => {
  jest.resetModules();
  jest.doMock("../utilities/url-params", () => ({
    urlParams: { firebaseEnv: env }
  }));

  return require("./firebase-config").firebaseConfig();
};

const getPortalFirebaseAppWithEnv = (env?: string) => {
  jest.resetModules();
  jest.doMock("../utilities/url-params", () => ({
    urlParams: { firebaseEnv: env }
  }));

  return require("./firebase-config").portalFirebaseApp();
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

describe("portalFirebaseApp", () => {
  afterEach(() => {
    jest.resetModules();
  });

  // The portal signs CLUE's Firebase JWT with the service account of the `firebase_apps` row it is
  // asked for by name. That row has to belong to the project the client is talking to, or the token
  // is signed by one project and verified by another. These cases are what keep the two halves of
  // each environment together.
  it("asks for the production app by default", () => {
    expect(getPortalFirebaseAppWithEnv()).toBe("collaborative-learning");
  });

  it("asks for the production app when production is specified by URL param", () => {
    expect(getPortalFirebaseAppWithEnv("production")).toBe("collaborative-learning");
  });

  it("asks for the staging app when staging is specified by URL param", () => {
    expect(getPortalFirebaseAppWithEnv("staging")).toBe("collaborative-learning-staging");
  });

  it("asks for the production app when an unrecognized value is provided", () => {
    expect(getPortalFirebaseAppWithEnv("does-not-exist")).toBe("collaborative-learning");
  });

  it("keeps the client config and the portal app on the same environment", () => {
    // The failure this rules out: the client talking to staging while the JWT is signed by the
    // production service account, which is what the two-table version of this allowed.
    expect(getConfigWithEnv("staging").projectId).toBe("collaborative-learning-staging");
    expect(getPortalFirebaseAppWithEnv("staging")).toBe("collaborative-learning-staging");

    expect(getConfigWithEnv("production").projectId).toBe("collaborative-learning-ec215");
    expect(getPortalFirebaseAppWithEnv("production")).toBe("collaborative-learning");
  });
});
