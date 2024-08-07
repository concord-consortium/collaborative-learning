import { each } from "lodash";

// cf. https://github.com/jaywcjlove/hotkeys

// unprintables and punctuation
const _keyMap: { [key: number]: string } = {
  8: "backspace",
  9: "tab",
  12: "clear",
  13: "return",
  27: "escape",
  32: "space",
  33: "pageup",
  34: "pagedown",
  35: "end",
  36: "home",
  37: "left",
  38: "up",
  39: "right",
  40: "down",
  45: "insert",
  46: "delete",
  186: ";",
  187: "=",
  188: ",",
  189: "-",
  190: ".",
  191: "/",
  192: "`",
  219: "[",
  220: "\\",
  221: "]",
  222: "'"
};

function keyCodeToString(keyCode: number) {
  // non-printables and punctuation
  if (_keyMap[keyCode]) return _keyMap[keyCode];
  // letters
  if ((keyCode >= 65) && (keyCode <= 90)) {
    return String.fromCharCode(keyCode);
  }
  // digits
  if ((keyCode >= 48) && (keyCode <= 57)) {
    return String.fromCharCode(keyCode);
  }
  // function keys
  if ((keyCode >= 112) && (keyCode <= 123)) {
    return `f${keyCode - 112 + 1}`;
  }
}

export function platformCmdKey() {
  const isMac = navigator.platform.indexOf("Mac") === 0;
  return isMac ? "meta" : "ctrl";
}

export type HotKeyHandler = (e: React.KeyboardEvent, keys: string) => boolean | void | Promise<void>;

export interface IHotKeyMap {
  [keys: string]: HotKeyHandler;
}

export class HotKeys {

  private hotKeyMap: IHotKeyMap = {};

  private canonicalizeKeys(keys: string) {
    const cmdKey = platformCmdKey();
    return keys.toLowerCase()
      .replace("cmd", cmdKey)
      .replace("control", "ctrl")
      .replace("option", "alt")
      .replace("arrow", "");
  }

  /*
   * [ctrl|meta|cmd]-[alt|option]-[shift]-[char]
   */
  public register(hotKeys: IHotKeyMap) {
    each(hotKeys, (handler, keys) => {
      const _keys = this.canonicalizeKeys(keys);
      this.hotKeyMap[_keys] = handler;
    });
  }

  public unregister(keys: string[]) {
    each(keys, (key) => {
      delete this.hotKeyMap[this.canonicalizeKeys(key)];
    });
  }

  public dispatch(e: React.KeyboardEvent) {
    let keys = "";
    if (e.ctrlKey) {
      keys += (keys ? "-" : "") + "ctrl";
    }
    if (e.metaKey) {
      keys += (keys ? "-" : "") + "meta";
    }
    if (e.altKey) {
      keys += (keys ? "-" : "") + "alt";
    }
    if (e.shiftKey) {
      keys += (keys ? "-" : "") + "shift";
    }
    const str = keyCodeToString(e.keyCode);
    if (str) {
      keys += (keys ? "-" : "") + str.toLowerCase();
    }

    const handler = this.hotKeyMap[keys];

    if (handler) {
      const result = handler(e, keys);
      if (result) {
        e.preventDefault();
        e.stopPropagation();
      }
      return true;
    }
  }
}
