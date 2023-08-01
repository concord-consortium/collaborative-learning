import React, { CSSProperties, useLayoutEffect, useRef, useState } from "react";

export const LINE_HEIGHT = 15;

interface ISvgTextProps {
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    style: CSSProperties
  }

export const WrappedSvgText = function({text, x, y, width, height, style}: ISvgTextProps) {

    // Strategy for flowing text into a box with the given width:
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
    const textRef = useRef<SVGTextElement>(null);

    useLayoutEffect(() => {
        const tr = textRef.current;
        if (tr) {
            if(experimentalLine.length > 1 && tr.getComputedTextLength() > width) {
                console.log(`experimental line (${experimentalLine}) too long`);
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
    });

    let lines: JSX.Element[] = [];
    let i=0;
    completedLines.forEach((textChunk) => {
        lines.push(<tspan key={i++} x={x} dy={LINE_HEIGHT}>{textChunk}</tspan>);
    });
    lines.push(<tspan ref={textRef} key={i++} x={x} dy={LINE_HEIGHT}>{experimentalLine.join(' ')}</tspan>);
    lines.push(<tspan key={i++} x={x} dy={LINE_HEIGHT}>{remainingText.join(' ')}</tspan>);

    return(
        <text x={x} y={y} width={width} height={height} style={style}>
          {lines}
        </text>);
}
