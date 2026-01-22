import { AppConfigModel } from "../models/stores/app-config-model";
import { unitConfigDefaults } from "../test-fixtures/sample-unit-configurations";
import { useSortOptions } from "./use-sort-options";

const mockUseContext = jest.fn();
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useContext: () => mockUseContext(),
  useMemo: (fn: () => any) => fn()
}));

describe("useSortOptions", () => {
  function resetMocks() {
    mockUseContext.mockReset();
  }

  function setupMockStores(configOverrides: Record<string, any> = {}) {
    const config = { ...unitConfigDefaults, ...configOverrides };
    const appConfig = AppConfigModel.create({ config });
    mockUseContext.mockImplementation(() => ({
      stores: { appConfig }
    }));
    return appConfig;
  }

  describe("default behavior (no sortWorkConfig)", () => {
    beforeEach(() => resetMocks());

    it("should return default sort options when no config is provided", () => {
      setupMockStores();
      const { sortOptions, showContextFilter, defaultPrimarySort } = useSortOptions();

      // Default options: Date, Group, Name, Strategy (if tagPrompt), Bookmarked, Tools
      // Since no tagPrompt is configured, Strategy should be filtered out
      expect(sortOptions.map(o => o.type)).toEqual(["Date", "Group", "Name", "Bookmarked", "Tools"]);
      expect(showContextFilter).toBe(true);
      expect(defaultPrimarySort).toBe("Group");
    });

    it("should include Strategy option when tagPrompt is configured", () => {
      setupMockStores({ tagPrompt: "Design Approach", showCommentTag: true });
      const { sortOptions } = useSortOptions();

      expect(sortOptions.map(o => o.type)).toContain("Strategy");
      const strategyOption = sortOptions.find(o => o.type === "Strategy");
      expect(strategyOption?.label).toBe("Design Approach");
    });

    it("should filter out Group when autoAssignStudentsToIndividualGroups is true", () => {
      setupMockStores({ autoAssignStudentsToIndividualGroups: true });
      const { sortOptions, defaultPrimarySort } = useSortOptions();

      expect(sortOptions.map(o => o.type)).not.toContain("Group");
      // Default should fall back to Name when Group is not available
      expect(defaultPrimarySort).toBe("Name");
    });

    it("should use default labels for sort options", () => {
      setupMockStores();
      const { sortOptions } = useSortOptions();

      const nameOption = sortOptions.find(o => o.type === "Name");
      expect(nameOption?.label).toBe("Student");

      const bookmarkedOption = sortOptions.find(o => o.type === "Bookmarked");
      expect(bookmarkedOption?.label).toBe("Bookmarked");
    });
  });

  describe("with sortWorkConfig", () => {
    beforeEach(() => resetMocks());

    it("should use custom sort options from config", () => {
      setupMockStores({
        sortWorkConfig: {
          sortOptions: [
            { type: "Name" },
            { type: "Problem" },
            { type: "Tools" }
          ]
        }
      });
      const { sortOptions } = useSortOptions();

      expect(sortOptions.map(o => o.type)).toEqual(["Name", "Problem", "Tools"]);
    });

    it("should use custom labels from config", () => {
      setupMockStores({
        sortWorkConfig: {
          sortOptions: [
            { type: "Group" },
            { type: "Name" },
            { type: "Bookmarked" }
          ]
        },
        customLabels: {
          Group: "Team",
          Name: "Participant",
          Bookmarked: "Starred"
        }
      });
      const { sortOptions } = useSortOptions();

      expect(sortOptions.find(o => o.type === "Group")?.label).toBe("Team");
      expect(sortOptions.find(o => o.type === "Name")?.label).toBe("Participant");
      expect(sortOptions.find(o => o.type === "Bookmarked")?.label).toBe("Starred");
    });

    it("should respect defaultPrimarySort from config", () => {
      setupMockStores({
        sortWorkConfig: {
          sortOptions: [
            { type: "Name" },
            { type: "Group" },
            { type: "Tools" }
          ],
          defaultPrimarySort: "Name"
        }
      });
      const { defaultPrimarySort } = useSortOptions();

      expect(defaultPrimarySort).toBe("Name");
    });

    it("should fall back when defaultPrimarySort is filtered out", () => {
      // Configure Group as default, but also disable groups
      setupMockStores({
        autoAssignStudentsToIndividualGroups: true,
        sortWorkConfig: {
          sortOptions: [
            { type: "Group" },
            { type: "Name" },
            { type: "Tools" }
          ],
          defaultPrimarySort: "Group"
        }
      });
      const { defaultPrimarySort, sortOptions } = useSortOptions();

      expect(sortOptions.map(o => o.type)).not.toContain("Group");
      expect(defaultPrimarySort).toBe("Name");
    });

    it("should respect showContextFilter from config", () => {
      setupMockStores({
        sortWorkConfig: {
          showContextFilter: false
        }
      });
      const { showContextFilter } = useSortOptions();

      expect(showContextFilter).toBe(false);
    });

    it("should still filter out Group when autoAssignStudentsToIndividualGroups is true", () => {
      setupMockStores({
        autoAssignStudentsToIndividualGroups: true,
        sortWorkConfig: {
          sortOptions: [
            { type: "Group" },
            { type: "Name" },
            { type: "Tools" }
          ]
        }
      });
      const { sortOptions } = useSortOptions();

      expect(sortOptions.map(o => o.type)).toEqual(["Name", "Tools"]);
    });

    it("should still filter out Strategy when no tagPrompt is configured", () => {
      setupMockStores({
        sortWorkConfig: {
          sortOptions: [
            { type: "Strategy" },
            { type: "Name" },
            { type: "Tools" }
          ]
        }
      });
      const { sortOptions } = useSortOptions();

      expect(sortOptions.map(o => o.type)).toEqual(["Name", "Tools"]);
    });
  });

  describe("isValidSortType", () => {
    beforeEach(() => resetMocks());

    it("should return true for valid sort types", () => {
      setupMockStores();
      const { isValidSortType } = useSortOptions();

      expect(isValidSortType("Group")).toBe(true);
      expect(isValidSortType("Name")).toBe(true);
      expect(isValidSortType("Date")).toBe(true);
    });

    it("should return false for invalid sort types", () => {
      setupMockStores();
      const { isValidSortType } = useSortOptions();

      expect(isValidSortType("Problem")).toBe(false); // Not in default options
      expect(isValidSortType("InvalidType")).toBe(false);
    });

    it("should return false for filtered out types", () => {
      setupMockStores({ autoAssignStudentsToIndividualGroups: true });
      const { isValidSortType } = useSortOptions();

      expect(isValidSortType("Group")).toBe(false);
    });
  });

  describe("getLabelForType", () => {
    beforeEach(() => resetMocks());

    it("should return custom label for configured types", () => {
      setupMockStores({
        sortWorkConfig: {
          sortOptions: [
            { type: "Name" }
          ]
        },
        customLabels: {
          Name: "Participant"
        }
      });
      const { getLabelForType } = useSortOptions();

      expect(getLabelForType("Name")).toBe("Participant");
    });

    it("should return default label for unconfigured types", () => {
      setupMockStores();
      const { getLabelForType } = useSortOptions();

      expect(getLabelForType("Name")).toBe("Student");
      expect(getLabelForType("Group")).toBe("Group");
    });

    it("should return tagPrompt for Strategy type", () => {
      setupMockStores({ tagPrompt: "Design Approach", showCommentTag: true });
      const { getLabelForType } = useSortOptions();

      expect(getLabelForType("Strategy")).toBe("Design Approach");
    });
  });
});
