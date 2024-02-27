import React, { ReactNode } from "react";
import { IDropdownItem } from "@concord-consortium/react-components";
import ArrowIcon from "../../assets/icons/arrow/arrow.svg";

import "./custom-select.sass";

export interface ICustomDropdownItem extends IDropdownItem {
  id?: string;
  itemIcon?: ReactNode;
}

function getItemId(item: ICustomDropdownItem) {
  return item.id || item.text.toLowerCase().replace(" ", "-");
}

interface IProps {
  className?: string;
  dataTest?: string;
  items: ICustomDropdownItem[];
  isDisabled?: boolean;
  showItemChecks?: boolean; // default true for existing clients
  showItemIcons?: boolean;  // default false
  title?: string;
  titlePrefix?: string;
  titleIcon?: ReactNode;
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
      selected: props.items.find(item => item.selected)?.text ||
                (props.items.length > 0 ? props.items[0].text : ""),
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
    const { className, isDisabled, items } = this.props;
    console.log("📁 custom-select.tsx ------------------------");
    console.log("\t🥩 isDisabled:", isDisabled);
    console.log("\t🥩 className:", className);
    console.log("\t🥩 items:", items);


     return (
      <div className={`custom-select ${className || ""}`}
          data-test={this.getDataTest()} ref={this.divRef}>
        { this.renderHeader() }
        { (!isDisabled && items.length > 0) && this.renderList() }
      </div>
    );
  }

  private getDataTest(suffix?: string) {
    const { dataTest } = this.props;
    return `${dataTest || "custom-select"}${suffix ? "-" + suffix : ""}`;
  }

  private renderHeader = () => {
    const { items, isDisabled, title, titlePrefix, titleIcon } = this.props;
    const selectedItem = items.find(i => i.text === this.state.selected);
    const titleText = title || selectedItem?.text;
    const showListClass = this.state.showList ? "show-list" : "";
    const disabled = isDisabled || items.length === 0 ? "disabled" : "";
    return (
      <div className={`header ${showListClass} ${disabled}`}
        data-test={this.getDataTest("header")} onClick={this.handleHeaderClick}>
        {titleIcon && <div className="title-icon">{titleIcon}</div>}
        { titlePrefix
          ? <div className="title-container">
              <div className="title-prefix">{titlePrefix}</div>
              <div className="title">{titleText}</div>
            </div>
          : <div className="item line-clamp">{titleText}</div>
        }
        <ArrowIcon className={`arrow ${showListClass} ${disabled}`} />
      </div>
    );
  };

  private renderItemIcon = (item: ICustomDropdownItem) => {
    const { showItemIcons } = this.props;
    const { itemIcon } = item;

    return showItemIcons && (
      <div className={`item-icon ${getItemId(item)}`}>
        {itemIcon}
      </div>
    );
  };

  private renderList = () => {
    const { items, showItemChecks } = this.props;
    return (
      <div className={`list ${(this.state.showList ? "show" : "")}`}
          data-test={this.getDataTest("list")} >
        { items?.map((item, i) => {
          const disabledClass = item.disabled ? "disabled" : "enabled";
          const selectedClass = this.state.selected === item.text ? "selected" : "";
          const itemId = getItemId(item);
          return (
            <div
              key={`item-${i}-${itemId}`}
              className={`list-item ${disabledClass} ${selectedClass}`}
              onClick={this.handleListClick(item)}
              data-test={`list-item-${itemId}`}
            >
              {(showItemChecks !== false) && <div className={`check ${selectedClass}`} />}
              {this.renderItemIcon(item)}
              <div className="item">{item.text}</div>
            </div>
          );
        }) }
      </div>
    );
  };

  private handleDown = (e: MouseEvent | TouchEvent) => {
    console.log("-------------------------");
    console.log("handleDown with e:", e);
    if (this.divRef.current && e.target && !this.divRef.current.contains(e.target as Node)) {
      this.setState({
        showList: false
      });
      console.log("handleDown if true, showList = ", this.state.showList);

    }
  };

  private handleHeaderClick = () => {
    console.log("-------------------------");

    console.log("➡️ handleHeaderClick");
    console.log("\t🔪 state.showList:", this.state.showList);
    this.setState(state => ({ showList: !state.showList }));
    console.log("\t🔪 state.showList:", this.state.showList);

  };

  private handleListClick = (item: IDropdownItem) => () => {
    console.log("-------------------------");
    console.log("➡️ handleListClick");
    const { onClick } = item;
    onClick && onClick(item);
    this.setState({
      selected: item.text,
      showList: false
    });
  };
}
