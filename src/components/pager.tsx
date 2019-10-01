import * as React from "react";
import { Button, ButtonGroup } from "@blueprintjs/core";
import { FLEX_EXPANDER } from "@blueprintjs/core/lib/esm/common/classes";

import "./pager.sass";

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

  return (
    <div className="pager">
      <div className="toggle-group">
        <div className="previous-page-button toggle-button" onClick={handlePreviousPage} >
        </div>
        <div className="next-page-button toggle-button" onClick={handleNextPage} >

        </div>
      </div>

      {/* <ButtonGroup className="pager-group" vertical={true}>
          <Button className="previous-page-button" onClick={handlePreviousPage} disabled={disablePrevious} />
          <Button className="next-page-button" onClick={handleNextPage} disabled={disableNext} />
      </ButtonGroup> */}
    </div>
  );
}
