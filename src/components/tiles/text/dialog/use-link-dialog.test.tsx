import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { LinkDialogContent } from "./use-link-dialog";

describe("LinkDialogContent", () => {
  const defaultProps = {
    setUrl: jest.fn(),
    displayMode: "link",
    setDisplayMode: jest.fn(),
    text: "example text",
    url: "https://example.com"
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with Link radio selected by default", () => {
    render(<LinkDialogContent {...defaultProps} />);
    const linkRadio = screen.getByLabelText("Link") as HTMLInputElement;
    const buttonRadio = screen.getByLabelText("Button") as HTMLInputElement;
    expect(linkRadio.checked).toBe(true);
    expect(buttonRadio.checked).toBe(false);
  });

  it("renders with Button radio selected when displayMode is button", () => {
    render(<LinkDialogContent {...defaultProps} displayMode="button" />);
    const linkRadio = screen.getByLabelText("Link") as HTMLInputElement;
    const buttonRadio = screen.getByLabelText("Button") as HTMLInputElement;
    expect(linkRadio.checked).toBe(false);
    expect(buttonRadio.checked).toBe(true);
  });

  it("calls setDisplayMode when Button radio is clicked", () => {
    render(<LinkDialogContent {...defaultProps} />);
    const buttonRadio = screen.getByLabelText("Button");
    fireEvent.click(buttonRadio);
    expect(defaultProps.setDisplayMode).toHaveBeenCalledWith("button");
  });

  it("calls setDisplayMode when Link radio is clicked", () => {
    render(<LinkDialogContent {...defaultProps} displayMode="button" />);
    const linkRadio = screen.getByLabelText("Link");
    fireEvent.click(linkRadio);
    expect(defaultProps.setDisplayMode).toHaveBeenCalledWith("link");
  });

  it("renders the Display as fieldset with legend", () => {
    render(<LinkDialogContent {...defaultProps} />);
    expect(screen.getByText("Display as:")).toBeInTheDocument();
  });

  it("renders the URL input with current value", () => {
    render(<LinkDialogContent {...defaultProps} />);
    const input = screen.getByPlaceholderText("URL") as HTMLInputElement;
    expect(input.value).toBe("https://example.com");
  });

  it("calls setUrl when input changes", () => {
    render(<LinkDialogContent {...defaultProps} />);
    const input = screen.getByPlaceholderText("URL");
    fireEvent.change(input, { target: { value: "https://new-url.com" } });
    expect(defaultProps.setUrl).toHaveBeenCalled();
  });
});
