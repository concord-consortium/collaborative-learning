export const AppModes = ["authed", "dev", "test", "demo", "qa"] as const;
export type AppMode = typeof AppModes[number];

export const kDemoSiteStorageKey = "clue-demo-name";
