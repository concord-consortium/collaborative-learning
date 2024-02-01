import React, { useEffect, useRef } from 'react';

import './cases-count-display.scss';

interface IProps {
  totalCases: number;
  label?: string;
}

export const CasesCountDisplay: React.FC<IProps> = ({ totalCases, label }) => {
  const countRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (countRef.current && shadowRef.current) {
      const width = countRef.current.offsetWidth;
      shadowRef.current.style.width = `${width}px`;
    }
  }, [totalCases]);

  return (
    <div className="total-cards-area">
      {label}
      <div className="cases-count" ref={countRef}>
        { totalCases }
      </div>
      <div className="cases-count-background-card" ref={shadowRef}></div>
    </div>
  );
};
