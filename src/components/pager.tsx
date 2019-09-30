import * as React from "react";
import { Button, ButtonGroup } from "@blueprintjs/core";

interface IPagerProps {
  numPages: number;
  currentPage: number;
  setPage: (page: number) => void;
}

export function Pager(props: IPagerProps) {
  const { currentPage, numPages, setPage } = props;
  const prevPage = Math.max(0, currentPage - 1);
  const nextPage =  Math.min(numPages, currentPage + 1);
  const handlePreviousPage = () => setPage(prevPage);
  const handleNextPage = () => setPage(nextPage);
  const disablePrevious = currentPage <= prevPage;
  const disableNext = currentPage >= nextPage;
  return (
    <div className="teacher-group-six-pack-pager">
      <ButtonGroup>
        <Button onClick={handlePreviousPage} disabled={disablePrevious}>« Previous</Button>
        <Button onClick={handleNextPage} disabled={disableNext}>Next »</Button>
      </ButtonGroup>
    </div>
  );
}
