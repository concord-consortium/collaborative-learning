import React, { useRef } from "react";
import TextInputSvg from "../../assets/icons/text-input.svg";
import { useCustomModal } from "../../hooks/use-custom-modal";

import "./single-string-dialog.scss";

interface IProps {
  className?: string;
  title: string;
  prompt?: string;
  label?: string;
  placeholder?: string;
  value?: string;
  maxLength?: number;
  context?: any;
  onAccept: (value: string, context?: any) => void;
  onClose?: () => void;
}
export const useSingleStringDialog = ({
  className, title, prompt, label, placeholder, value, maxLength, context, onAccept, onClose
}: IProps) => {

  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);

  const Content: React.FC = () => {
    return (
      <>
        {prompt && <div className="prompt">{prompt}</div>}
        <div className="input-row">
          {label && <label htmlFor="string-input">{label}</label>}
          <input type="text" ref={inputRef} id="string-input" placeholder={placeholder} maxLength={maxLength}
                  defaultValue={value} onBlur={e => valueRef.current = inputRef.current?.value}/>
        </div>
      </>
    );
  };

  return useCustomModal({
    className: `single-string ${className || ""}`,
    title,
    Icon: TextInputSvg,
    Content,
    contentProps: {},
    focusElement: "#string-input",
    buttons: [
      { label: "Cancel" },
      { label: "OK", isDefault: true,
        onClick: () => onAccept(inputRef.current?.value || valueRef.current || "", context)}
    ],
    onClose
  });
};
