import React from 'react';

interface IProps {
  fullString: string;
  matchString: string;
}

/**
 * This component is used to create the span for the item(s) in the typeahead list
 * It will bold the match string and keep the result to a length that fits in the dropdown
 */
export const TypeAheadItemSpan: React.FC<IProps> = ({ fullString, matchString }) => {
  const lettersLength = fullString.length;
  const maxBoldedCharsToShow = 15;

  // if no match string, we just want to show as much of the value as can fit
  if (!matchString) {
    if (lettersLength < 20){
      return (
        <span>{fullString}</span>
      );
    } else {
      const lettersTruncated = fullString.slice(0, 20);
      return (
        <span>{lettersTruncated}...</span>
      );
    }
  }

  else {
    const matchIndex = fullString.toLowerCase().indexOf(matchString.toLowerCase());
    const matchEndIndex = matchIndex + matchString.length;
    const match = fullString.slice(matchIndex, matchEndIndex);
    const lettersBeforeMatch = fullString.slice(0, matchIndex);
    const lettersAfterMatch = fullString.slice(matchEndIndex);

    // our whole string, match inclusive, is going to fit in the dropdown
    if (lettersLength < 20){
      return (
        <span>
          {lettersBeforeMatch}<b>{match}</b>{lettersAfterMatch}
        </span>
      );
    }

    // the whole string is probably too long to fit in the dropdown
    // but we want to show the full match, with some of the characters before and after
    else {
      const lettersBeforeMatchTruncated = lettersBeforeMatch.slice(0, 5);
      const lettersAfterMatchTruncated = lettersAfterMatch.slice(0, 5);
      const truncatedMatch = matchString.slice(0, maxBoldedCharsToShow) + " ...";
      return (
        <span>
          {lettersBeforeMatchTruncated}<b>{truncatedMatch}</b>{lettersAfterMatchTruncated}...
        </span>
      );
    }
  }
};

