import React from "react";

import "./problem-select.sass";

interface IProps {
  items: string[];
  onSelectItem?: (value: string) => void;
  isDisabled?: boolean;
}

interface IState {
  selected: string;
  showList: boolean;
}

export class ProblemSelect extends React.PureComponent<IProps, IState> {
  private divRef = React.createRef<HTMLDivElement>();
  constructor(props: IProps) {
    super(props);
    this.state = {
      selected: props.items[0],
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
      <div className="problem-select" ref={this.divRef}>
        { this.renderHeader() }
        { this.renderList() }
      </div>
    );
  }

  private renderHeader = () => {
    const { items, isDisabled } = this.props;
    const selectedItem = items.find(i => i === this.state.selected);
    const showListClass = this.state.showList ? "show-list" : "";
    const disabled = isDisabled ? "disabled" : "";
    return (
      <div className={`header ${showListClass} ${disabled}`} onClick={this.handleHeaderClick}>
        <div className="item line-clamp">{selectedItem && selectedItem}</div>
        <div className={`arrow ${showListClass} ${disabled}`} />
      </div>
    );
  }

  private renderList = () => {
    const { items } = this.props;
    return (
      <div className={`list ${(this.state.showList ?"show" : "")}`}>
        { items?.map((item: string, i: number) => {
          const selectedClass = this.state.selected === item ? "selected" : "";
          return (
            <div
              key={`item ${i}`}
              className={`list-item ${selectedClass}`}
              onClick={this.handleListClick(item)}
              data-test={`list-item-${item.toLowerCase().replace(" ", "-")}`}
            >
              <div className={`check ${selectedClass}`} />
              <div className="item">{item}</div>
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

  private handleListClick = (selected: string) => () => {
    const { onSelectItem } = this.props;
    onSelectItem && onSelectItem(selected);
    this.setState({
      selected,
      showList: false
    });
  }
}
