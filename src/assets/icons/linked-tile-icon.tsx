import React from "react";

interface IProps {
  className?: string;
  fillColor: string;
}

function SvgLinkedTileIcon(props: IProps) {
  const { fillColor, ...others } = props;
  return (
    <svg viewBox="0 0 19 19" width="1em" height="1em" {...others}>
      <path
        fill={fillColor}
        // eslint-disable-next-line max-len
        d="M10.52 13.43L9 15a3.49 3.49 0 01-5 0 3.42 3.42 0 01-1-2.5A3.46 3.46 0 014 10l2.5-2.45a3.59 3.59 0 014.95 0 3.89 3.89 0 01.32.39l-1.39 1.39h-.07A1.71 1.71 0 0010 9a1.53 1.53 0 00-2.09 0l-2.47 2.44a1.5 1.5 0 000 2.12 1.49 1.49 0 002.12 0L8.1 13a4.35 4.35 0 001.93.45c.16.02.33-.01.49-.02zM15 4a3.48 3.48 0 00-5 0L8.44 5.61A4.71 4.71 0 019 5.56a4.6 4.6 0 011.89.44l.55-.55a1.5 1.5 0 112.12 2.12L11.09 10A1.56 1.56 0 019 10a1.58 1.58 0 01-.27-.42l-.07.05-1.43 1.43a3 3 0 00.32.39 3.51 3.51 0 005 0L15 9a3.46 3.46 0 001-2.5A3.42 3.42 0 0015 4z"
      />
    </svg>
  );
}

export default SvgLinkedTileIcon;
