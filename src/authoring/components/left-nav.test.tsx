import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import LeftNav from "./left-nav";

const mockCurriculumValue = {
  unitConfig: undefined,
  teacherGuideConfig: undefined,
  branch: "main",
  unit: "test-unit",
  files: undefined,
  exemplarFiles: [] as Array<{ path: string; title: string }>,
};
jest.mock("../hooks/use-curriculum", () => ({
  useCurriculum: () => mockCurriculumValue
}));

const mockAuthValue: { isAdminUser: boolean } = { isAdminUser: false };
jest.mock("../hooks/use-auth", () => ({
  useAuth: () => mockAuthValue
}));

describe("LeftNav", () => {
  beforeEach(() => {
    mockAuthValue.isAdminUser = false;
  });

  it("does not offer the Unit Summary item to a user who is not CC staff", () => {
    render(<LeftNav />);
    fireEvent.click(screen.getByText("Configuration"));
    expect(screen.queryByText("Unit Summary")).not.toBeInTheDocument();
  });

  it("offers the Unit Summary item to CC staff, the same way it already gates Raw Unit JSON", () => {
    mockAuthValue.isAdminUser = true;
    render(<LeftNav />);
    fireEvent.click(screen.getByText("Configuration"));
    expect(screen.getByText("Unit Summary")).toBeInTheDocument();
    expect(screen.getByText("Raw Unit JSON (Admin Only)")).toBeInTheDocument();
  });
});
