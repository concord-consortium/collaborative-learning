import * as React from "react";
import { emitTableEvent } from "../../../models/tools/table/table-events";

export interface IProps {
  reactContainer: any;
  column: any;
  displayName: string;
  progressSort(multiSort: boolean): void;
}

export interface IState {
  sort: string|null;
}

export class TableHeader extends React.Component<IProps, IState> {
  private handleClickTimeOut = 0;
  private lastClick = 0;

  constructor(props: IProps) {
    super(props);

    props.reactContainer.style.display = "inline-block";
    props.column.addEventListener("sortChanged", this.handleSortChanged);

    this.state = {
      sort: null
    };
  }

  public render() {
    return (
      <div>
        <div
          className="customHeaderLabel"
          onClick={this.handleClick}
          draggable={true}
          onDragStart={this.handleDragStart}
        >
          {this.props.displayName}
          {this.renderSort()}
        </div>
      </div>
    );
  }

  private handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const multiSort = e.shiftKey;
    const now = Date.now();
    clearTimeout(this.handleClickTimeOut);

    if (now - this.lastClick < 250) {
      emitTableEvent({
        type: "rename-column",
        id: this.props.column.colId,
        name: this.props.column.colDef.headerName
      });
    }
    else {
      this.handleClickTimeOut = window.setTimeout(() => {
        this.props.progressSort(multiSort);
      }, 250);
    }
    this.lastClick = now;
  }

  private handleSortChanged = () => {
    let sort: string|null = null;
    const {column} = this.props;
    if (column.isSortAscending()) {
      sort = "asc";
    }
    else if (column.isSortDescending()) {
      sort = "desc";
    }
    this.setState({sort});
  }

  private handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const data = {
      type: "drag-column-from-case-table",
      name: this.props.column.colDef.headerName
    };
    e.dataTransfer.setData("text", JSON.stringify(data));
  }

  private renderSort() {
    const {sort} = this.state;
    return sort ? <i className={`ag-icon ag-icon-${sort}`} /> : null;
  }

}
