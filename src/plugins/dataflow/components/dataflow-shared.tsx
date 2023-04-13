export interface IDataFlowActionHandlers {
  handleRequestTableLink: (tableId: string) => void;
  handleRequestTableUnlink: (tableId: string) => void;
}
