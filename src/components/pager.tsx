import * as React from "react";
import { Button, ButtonGroup } from "@blueprintjs/core";
import { FLEX_EXPANDER } from "@blueprintjs/core/lib/esm/common/classes";

interface IPagerProps {
  numPages: number;
  currentPage: number;
  setPage: (page: number) => void;
}

export function Pager(props: IPagerProps) {
  const { currentPage, numPages, setPage } = props;
  const prevPage = Math.max(0, currentPage - 1);
  const nextPage =  Math.min(numPages - 1, currentPage + 1);
  const handlePreviousPage = () => setPage(prevPage);
  const handleNextPage = () => setPage(nextPage);
  const disablePrevious = currentPage <= prevPage;
  const disableNext = currentPage >= nextPage;

  const style: React.CSSProperties = {
    display: "flex",
    flexDirection: "column"
  };

  const upStyle: React.CSSProperties = {
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    backgroundImage: `url("../../assets/icons/pager/up.svg")`
  };

  const downStyle: React.CSSProperties = {
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    backgroundImage: `url("../../assets/icons/pager/down.svg")`
  };

  return (
    <div className="pager">
      <ButtonGroup style={style}>
          <Button style={upStyle} onClick={handlePreviousPage} disabled={disablePrevious} />
          <Button style={downStyle} onClick={handleNextPage} disabled={disableNext} />
      </ButtonGroup>
    </div>
  );
}
