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
      return (
        <span>{fullString.slice(0, 20)}...</span>
      );
    }
  }

  else {
    const matchIndex = fullString.toLowerCase().indexOf(matchString.toLowerCase());
    const matchEndIndex = matchIndex + matchString.length;
    const match = fullString.slice(matchIndex, matchEndIndex);
    const charsBefore = fullString.slice(0, matchIndex);
    const charsAfter = fullString.slice(matchEndIndex);


    // our whole string, match inclusive, is going to fit in the dropdown
    if (lettersLength < 20){
      return (
        <span>
          {charsBefore}<b>{match}</b>{charsAfter}
        </span>
      );
    }

    // the whole string is too long to fit in the dropdown
    // but we want to show the match in context
    else {
      const truncatedMatch = matchString.slice(0, maxBoldedCharsToShow);
      return (
        <span>
          ...{charsBefore.slice(-5)}<b>{truncatedMatch}</b>{charsAfter.slice(0, 5)}...
        </span>
      );
    }
  }
};

