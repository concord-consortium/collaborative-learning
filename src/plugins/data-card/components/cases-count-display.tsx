import React, { useEffect, useRef } from 'react';

import './cases-count-display.scss';

interface IProps {
  totalCases: number;
}

export const CasesCountDisplay: React.FC<IProps> = ({ totalCases }) => {
  const countRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (countRef.current && shadowRef.current) {
      const w = countRef.current.offsetWidth;
      const h = countRef.current.offsetHeight;
      shadowRef.current.style.width = `${w}px`;
      shadowRef.current.style.height = `${h}px`;
    }
  }, [totalCases]);

  return (
    <div className="total-cards-area">
      <div className="cases-count" ref={countRef}>
        { totalCases }
      </div>
      <div className="cases-count-background-card" ref={shadowRef}></div>
    </div>
  );
};
