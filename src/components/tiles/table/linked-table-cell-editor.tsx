// import { ICellEditorParams, TextCellEditor } from "@ag-grid-community/core";
// import { TableMetadataModelType } from "../../../models/tools/table/table-content";

// interface ILinkedTableCellEditorParams extends ICellEditorParams {
//   metadata: TableMetadataModelType;
// }

// export class LinkedTableCellEditor extends TextCellEditor {

//   private domInput: HTMLInputElement;
//   private metadata: TableMetadataModelType;

//   constructor() {
//     super();
//     this.domInput = this.getGui().querySelector("input") as HTMLInputElement;
//   }

//   public init(params: ICellEditorParams) {
//     super.init(params as any);
//     const _params = params as ILinkedTableCellEditorParams;
//     this.metadata = _params.metadata;
//   }

//   public afterGuiAttached() {
//     super.afterGuiAttached();
//     const eInput = this.domInput;
//     eInput && eInput.addEventListener("input", this.handleInputChange);
//   }

//   public destroy() {
//     const eInput = this.domInput;
//     eInput && eInput.removeEventListener("input", this.handleInputChange);
//   }

//   public handleInputChange = (e: any) => {
//     const value = e.target.value;
//     if (!this.isValid(value)) {
//       this.domInput.classList.add("invalid-cell");
//     } else {
//       this.domInput.classList.remove("invalid-cell");
//     }
//   }

//   public isValid = (value: string) => {
//     // don't apply validation unless the table is linked
//     if (!this.metadata || !this.metadata.isLinked) return true;
//     // allow empty values
//     if ((value == null) || (value === "")) return true;
//     // non-empty values must be numeric
//     return isFinite(Number(value));
//   }

//   public isCancelAfterEnd = () => {
//     return !this.isValid(this.getValue());
//   }
// }
