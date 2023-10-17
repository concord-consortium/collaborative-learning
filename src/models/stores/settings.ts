import { Instance, types } from "mobx-state-tree";

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [x: string]: JSONValue }
  | Array<JSONValue>;

// The value of a setting can be essentially any JSON.
// They do not change at runtime so escape from MST type rules by using types.frozen
const SettingValueMstType = types.frozen<JSONValue>();
export const SettingsGroupMstType = types.map(SettingValueMstType);
export const SettingsMstType = types.map(types.union(SettingValueMstType, SettingsGroupMstType));

export type SettingValueType = JSONValue;
export type MaybeSettingValueType = SettingValueType | undefined;
export type SettingsGroupType = Instance<typeof SettingsGroupMstType>;
export type SettingsType = Instance<typeof SettingsMstType>;

export function getSetting(settings: SettingsType, key: string, group?: string): MaybeSettingValueType {
  if (group) {
    const groupObject = settings.get(group) as SettingsGroupType|undefined;
    return groupObject?.get(key);
  }
  return settings.get(key) as MaybeSettingValueType;
}
