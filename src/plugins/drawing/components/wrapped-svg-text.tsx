import React, { CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { useResizeDetector } from "react-resize-detector";

// Inter-line spacing, as a multiplier to the observed line height
const LINE_SPACING = 1.2;

interface ISvgTextProps {
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    style?: CSSProperties,
    sideways?: boolean // If true, the text is rotated so that "line height" is measured horizontally.
  }

// Creates an SVG <text> element of the given dimentions,
// with the requested text broken up into lines that fit within the given width
// Very long words will not be broken, and may extend past the width bound.
export const WrappedSvgText = function({text, x, y, width, height, style, sideways}: ISvgTextProps) {
    const [completedLines, setCompletedLines] = useState<string[]>([]);
    const [lineHeight, setLineHeight] = useState<number>(0);
    const textRef = useRef<SVGTextElement>(null);

    // This fixes a bug where line height was not being properly determined in 4-up mode;
    // I think the rendering is done before the 4-up quadrant is properly sized.
    // Use resize detector to force a recalculation.
    const {height: resizeHeight, width: resizeWidth, ref} = useResizeDetector();

    // This is implemented as a layout effect so that intermediate states are not rendered as a visible flash.
    useLayoutEffect(() => {
        // Strategy for flowing text into the box:
        // Start with an 'experimental line' containing all the words in the given text.
        // Loop:
        //   If experimental line is too long:
        //      Move its last word to 'remaining text'.
        //      Repeat until experimental line is short enough (or only one word is left on the line).
        //   Once experimental line is ok:
        //     Move it to 'done'
        //     Anything in 'remaining text' becomes the next 'experimental line'.
        // Repeat as long as there is 'remaining text'.

        const tr = textRef.current;
        if (tr) {
            let experimentalLine = text.split(/\s+/);
            let remainingText: string[] = [];
            const done: string[] = [];
            tr.textContent = experimentalLine.join(' ');
            const observedHeight = sideways ? tr.getBoundingClientRect().width : tr.getBoundingClientRect().height;
            if (observedHeight > lineHeight) {
                setLineHeight(observedHeight);
            }
            while(experimentalLine.length) {
                while(experimentalLine.length > 1 && tr.getComputedTextLength() > width) {
                    remainingText.unshift(experimentalLine.pop() || '?');
                    tr.textContent = experimentalLine.join(' ');
                }
                done.push(experimentalLine.join(' '));
                experimentalLine = remainingText;
                remainingText = [];
                tr.textContent = experimentalLine.join(' ');
            }
            setCompletedLines(done);
        }
    }, [text, width, lineHeight, resizeHeight, resizeWidth]);

    const lines: JSX.Element[] = [];
    const dy=lineHeight*LINE_SPACING;
    completedLines.forEach((textChunk, i) => {
        lines.push(<tspan key={i} x={x} dy={dy}>{textChunk}</tspan>);
    });

    return(
        <text ref={ref} x={x} y={y} width={width} height={height} style={style}>
          {lines}
          <tspan ref={textRef} x={x} dy={dy}></tspan>
        </text>);
};
