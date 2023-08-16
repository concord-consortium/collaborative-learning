import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface CircleData {
  value: number;
  id: string;
}

export const NumberlineToolComponent: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const circlesData: CircleData[] = [
    { value: -4, id: 'circle1' },
    { value: 0, id: 'circle2' },
    { value: 3, id: 'circle3' },
  ];

  useEffect(() => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);

      // Set up scales
      const xScale = d3.scaleLinear()
        .domain([-5, 5])
        .range([0, 500]);

      // Create number line axis
      svg.append('g')
        .attr('transform', 'translate(50, 50)')
        .call(d3.axisBottom(xScale).ticks(11));

      // Create circles
      const circles = svg.selectAll<SVGCircleElement, CircleData>('circle')
        .data(circlesData)
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.value) + 50)
        .attr('cy', 50)
        .attr('r', 10)
        .attr('fill', 'blue')
        .attr('id', d => d.id);

      // Drag behavior
      const dragHandler = d3.drag<SVGCircleElement, CircleData>()
        .on('drag', (event, d) => {
          const newValue = xScale.invert(event.x - 50);
          d.value = newValue; // Update to decimal value

          // Update the circle's position
          svg.select(`#${d.id}`)
            .attr('cx', xScale(d.value) + 50);
        });

      circles.call(dragHandler);
    }
  }, []);

  return (
    <svg ref={svgRef} width={600} height={100}></svg>
  );
};

export default NumberlineToolComponent;

