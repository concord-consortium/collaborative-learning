import React from "react";

import "./problem-select.sass";

interface IProps {
  items: string[];
  onSelectItem: (value: string) => void;
  isDisabled?: boolean;
}

interface IState {
  current: string;
  showList: boolean;
}

export class ProblemSelect extends React.PureComponent<IProps, IState> {
  private divRef = React.createRef<HTMLDivElement>();
  constructor(props: IProps) {
    super(props);
    this.state = {
      current: props.items[0],
      showList: false
    };
  }

  public componentDidMount() {
    document.addEventListener("mousedown", this.handleClick, false);
  }

  public componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleClick, false);
  }

  public render() {
    return (
      <div className="problem-select" ref={this.divRef}>
        { this.renderHeader() }
        { this.renderList() }
      </div>
    );
  }

  private renderHeader = () => {
    const { items, isDisabled } = this.props;
    const currentItem = items.find(i => i === this.state.current);
    const showListClass = this.state.showList ? "show-list" : "";
    const disabled = isDisabled ? "disabled" : "";
    return (
      <div className={`header ${showListClass} ${disabled}`} onClick={this.handleHeaderClick}>
        <div className="current">{currentItem && currentItem}</div>
        <div className={`arrow ${showListClass} ${disabled}`} />
      </div>
    );
  }

  private renderList = () => {
    const { items } = this.props;
    return (
      <div className={`list ${(this.state.showList ?"show" : "")}`}>
        { items && items.map((item: string, i: number) => {
          const currentClass = this.state.current === item ? "selected" : "";
          return (
            <div
              key={`item ${i}`}
              className={`list-item ${currentClass}`}
              onClick={this.handleListClick(item)}
              data-cy={`list-item-${item.toLowerCase().replace(" ", "-")}`}
            >
              <div className={`check ${currentClass}`} />
              <div className="item">{item}</div>
            </div>
          );
        }) }
      </div>
    );
  }

  private handleClick = (e: MouseEvent) => {
    if (this.divRef.current && e.target && !this.divRef.current.contains(e.target as Node)) {
      this.setState({
        showList: false
      });
    }
  }

  private handleHeaderClick = () => {
    this.setState({
      showList: !this.state.showList
    });
  }

  private handleListClick = (current: string) => () => {
    this.props.onSelectItem(current);
    this.setState({
      current,
      showList: false
    });
  }
}
