import React, { CSSProperties, useLayoutEffect, useRef, useState } from "react";

// Inter-line spacing, as a multiplier to the observed line height
const LINE_SPACING = 1.2;

interface ISvgTextProps {
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    style?: CSSProperties
  }

// Creates an SVG <text> element of the given dimentions, 
// with the requested text broken up into lines that fit within the given width
// Very long words will not be broken, and may extend past the width bound.
export const WrappedSvgText = function({text, x, y, width, height, style}: ISvgTextProps) {

    // Strategy for flowing text into the box:
    // Start with an 'experimental line' containing all the words in the given text.
    // Loop:
    //   If experimental line is too long:
    //      Move its last word to 'remaining text'.
    //      Repeat until experimental line is short enough (or only one word is left on the line).
    //   Once experimental line is ok:
    //     Move it to 'completed lines'
    //     Anything in 'remaining text' becomes the next 'experimental line'.
    // Repeat if there is any 'remaining text'.

    const [completedLines, setCompletedLines] = useState<string[]>([]);
    const [experimentalLine, setExperimentalLine] = useState<string[]>(text.split(/\s+/));
    const [remainingText, setRemainingText] = useState<string[]>([]);
    const [lineHeight, setLineHeight] = useState<number>(0);
    const textRef = useRef<SVGTextElement>(null);

    // This is implemented as a layout effect so that intermediate states are not rendered as a visible flash.
    useLayoutEffect(() => {
        const tr = textRef.current;
        if (tr) {
            const observedHeight = tr.getBoundingClientRect().height;
            if (observedHeight > lineHeight) {
                setLineHeight(observedHeight);
            }
            if(experimentalLine.length > 1 && tr.getComputedTextLength() > width) {
                // console.log(`experimental line (${experimentalLine}) too long`);
                const wordToMove = experimentalLine[experimentalLine.length - 1];
                setExperimentalLine(experimentalLine.slice(0, -1));
                setRemainingText([wordToMove, ...remainingText]);
            } else {
                if (experimentalLine.length) {
                    setCompletedLines([...completedLines, experimentalLine.join(' ')]);
                    setExperimentalLine(remainingText);
                    setRemainingText([]);
                }
            }
        }
    }, [text, width, completedLines, experimentalLine, remainingText, lineHeight]);

    const lines: JSX.Element[] = [];
    let i=0;
    const dy=lineHeight*LINE_SPACING;
    completedLines.forEach((textChunk) => {
        lines.push(<tspan key={i++} x={x} dy={dy}>{textChunk}</tspan>);
    });
    lines.push(<tspan ref={textRef} key={i++} x={x} dy={dy}>{experimentalLine.join(' ')}</tspan>);
    // There's no need to render the remainingText; there will be none when the process completes.

    return(
        <text x={x} y={y} width={width} height={height} style={style}>
          {lines}
        </text>);
};
