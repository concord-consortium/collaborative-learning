import { GroupModelType } from "../stores/groups";

export const kGroupVirtualDocumentType = "GroupVirtualDocumentType";
export interface IGroupVirtualDocument {
  id: string;
  type: string;
  key: string;
}

interface IGroupConstructorParams {
  id: string;
}
/*
  NP/DL: 2019-10-15 -- GroupVirtualDocuments are simple objects that behave
  superficially like "Documents" in the workspace view.

  Unlike regular Documents, they do not store data, and are only used for teachers
  to monitor (read-only) student groups.

  This work helps teachers quickly switch between multiple compare views of
  different workgroups.

  See PT Stories:
  https://www.pivotaltracker.com/story/show/168619033
  https://www.pivotaltracker.com/story/show/168711827
*/
export class GroupVirtualDocument {
  public readonly id: string;

  constructor(group: IGroupConstructorParams | GroupModelType) {
    this.id = group.id;
  }

  get type() {
    return kGroupVirtualDocumentType;
  }

  get key() {
    return `group-${this.id}`;
  }
}
