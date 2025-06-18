import React from "react";

import "./pager.scss";

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
  let previousClasses = "previous-page-button pager-button";
  let nextClasses = "next-page-button  pager-button";

  nextClasses = disableNext
    ? `${nextClasses} disabled`
    : nextClasses;

  previousClasses = disablePrevious
    ? `${previousClasses} disabled`
    : previousClasses;

  if (numPages <= 1) {
    previousClasses = `${previousClasses} invisible`;
    nextClasses = `${nextClasses} invisible`;
  }

  return (
      <div className="pager-group">
        <div
          className={previousClasses}
          onClick={handlePreviousPage}
        />
        <div
          className={nextClasses}
          onClick={handleNextPage}
        />
      </div>
    );

}
