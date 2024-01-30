import React from 'react';

interface TypeAheadItemSpanProps {
  fullString: string;
  matchString: string;
}

/**
 * The Downshift Dropdown typeahead component renders values that match the user's input.
 * In downshift dropdown, we want to highlight the part of the value that matches the user's input.
 * We don't want to display the entire value if it is too long.
 * @param fullString The full value of the item
 * @param matchString The string to highlight, if any
 * @returns jsx for the span
 */
export const TypeAheadItemSpan: React.FC<TypeAheadItemSpanProps> = ({ fullString, matchString }) => {
  const lettersLength = fullString.length;

  if (!matchString) {
    if (lettersLength < 20){
      return (<span>{fullString}</span>);
    } else {
      const lettersTruncated = fullString.slice(0, 20);
      return <span>{lettersTruncated}...</span>;
    }
  }

  const matchIndex = fullString.toLowerCase().indexOf(matchString.toLowerCase());
  const matchEndIndex = matchIndex + matchString.length;
  const match = fullString.slice(matchIndex, matchEndIndex);
  const lettersBeforeMatch = fullString.slice(0, matchIndex);
  const lettersAfterMatch = fullString.slice(matchEndIndex);

  if (lettersLength < 20){
    return <span>{lettersBeforeMatch}<b>{match}</b>{lettersAfterMatch}</span>;
  } else {
    const lettersBeforeMatchTruncated = lettersBeforeMatch.slice(0, 5);
    const lettersAfterMatchTruncated = lettersAfterMatch.slice(0, 5);
    const truncatedMatch = matchString.slice(0, 18) + "...";
    return <span>{lettersBeforeMatchTruncated}<b>{truncatedMatch}</b>{lettersAfterMatchTruncated}...</span>;
  }
};

