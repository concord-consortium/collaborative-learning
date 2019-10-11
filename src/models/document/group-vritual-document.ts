import {GroupModelType} from "../stores/groups";

export const kGroupVirtualDocumentType = "GroupVirtualDocumentType";
export interface IGroupVirtualDocument {
  id: string;
  type: string;
  key: string;
}

export class GroupVirtualDocument {
  public readonly id: string;

  constructor(group: GroupModelType) {
    this.id = group.id;
  }

  get type() {
    return kGroupVirtualDocumentType;
  }

  get key() {
    return `group-${this.id}`;
  }
}
