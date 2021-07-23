export const AppModes = ["authed", "dev", "test", "demo", "qa"] as const;
export type AppMode = typeof AppModes[number];
