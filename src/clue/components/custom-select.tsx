import React from "react";
import { IDropdownItem } from "@concord-consortium/react-components";

import "./custom-select.sass";

interface IProps {
  items: IDropdownItem[];
  isDisabled?: boolean;
  title?: string;
  titlePrefix?: string;
}

interface IState {
  selected: string;
  showList: boolean;
}

export class CustomSelect extends React.PureComponent<IProps, IState> {
  private divRef = React.createRef<HTMLDivElement>();
  constructor(props: IProps) {
    super(props);
    this.state = {
      selected: props.items.length > 0 ? props.items[0].text : "",
      showList: false
    };
  }

  public componentDidMount() {
    document.addEventListener("mousedown", this.handleDown, true);
    document.addEventListener("touchstart", this.handleDown, true);
  }

  public componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleDown, true);
    document.removeEventListener("touchstart", this.handleDown, true);
  }

  public render() {
    return (
      <div className="custom-select" ref={this.divRef}>
        { this.renderHeader() }
        { (!this.props.isDisabled && this.props.items.length > 0) && this.renderList() }
      </div>
    );
  }

  private renderHeader = () => {
    const { items, isDisabled, title, titlePrefix } = this.props;
    const selectedItem = items.find(i => i.text === this.state.selected);
    const showListClass = this.state.showList ? "show-list" : "";
    const disabled = isDisabled || items.length === 0 ? "disabled" : "";
    return (
      <div className={`header ${showListClass} ${disabled}`} onClick={this.handleHeaderClick}>
        { title
          ? <div className="title-container">
              { titlePrefix && <div className="title-prefix">{titlePrefix}</div> }
              <div className="title">{title}</div>
            </div>
          : <div className="item line-clamp">{selectedItem && selectedItem.text}</div>
        }
        <div className={`arrow ${showListClass} ${disabled}`} />
      </div>
    );
  }

  private renderList = () => {
    const { items } = this.props;
    return (
      <div className={`list ${(this.state.showList ?"show" : "")}`}>
        { items?.map((item: IDropdownItem, i: number) => {
          const selectedClass = this.state.selected === item.text ? "selected" : "";
          return (
            <div
              key={`item ${i}`}
              className={`list-item ${selectedClass}`}
              onClick={this.handleListClick(item)}
              data-test={`list-item-${item.text.toLowerCase().replace(" ", "-")}`}
            >
              <div className={`check ${selectedClass}`} />
              <div className="item">{item.text}</div>
            </div>
          );
        }) }
      </div>
    );
  }

  private handleDown = (e: MouseEvent | TouchEvent) => {
    if (this.divRef.current && e.target && !this.divRef.current.contains(e.target as Node)) {
      this.setState({
        showList: false
      });
    }
  }

  private handleHeaderClick = () => {
    this.setState(state => ({ showList: !state.showList }));
  }

  private handleListClick = (item: IDropdownItem) => () => {
    const { onClick } = item;
    onClick && onClick(item);
    this.setState({
      selected: item.text,
      showList: false
    });
  }
}
