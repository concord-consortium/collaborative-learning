export interface RenameColumnEvent {
  type: "rename-column";
  id: string;
  name: string;
}

export interface AddColumnEvent {
  type: "add-column";
}

export type TableEvent = RenameColumnEvent | AddColumnEvent;

export type Listener = (event: TableEvent) => void;

const listeners: Listener[] = [];

export const emitTableEvent = (event: TableEvent) => {
  listeners.forEach((listener) => listener(event));
};

export const listenForTableEvents = (listener: Listener) => {
  listeners.push(listener);
};
