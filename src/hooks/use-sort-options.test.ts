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

      // Default options: Date, Group, Name, Bookmarked, Tools
      // Note: Strategy is excluded because no term override is set
      expect(sortOptions.map(o => o.type)).toEqual(["Date", "Group", "Name", "Bookmarked", "Tools"]);
      expect(showContextFilter).toBe(true);
      expect(defaultPrimarySort).toBe("Group");
    });

    it("should include Strategy option when the term is overridden", () => {
      setupMockStores({ termOverrides: { strategy: "Design Approach" }, showCommentTag: true });
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
          sortOptions: ["Name", "Problem", "Tools"]
        }
      });
      const { sortOptions } = useSortOptions();

      expect(sortOptions.map(o => o.type)).toEqual(["Name", "Problem", "Tools"]);
    });

    it("should use custom labels from config", () => {
      setupMockStores({
        sortWorkConfig: {
          sortOptions: ["Group", "Name", "Bookmarked"]
        },
        termOverrides: {
          studentGroup: "Team",
          "sortLabel.sortByOwner": "Participant",
          bookmarked: "Starred"
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
          sortOptions: ["Name", "Group", "Tools"],
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
          sortOptions: ["Group", "Name", "Tools"],
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
          sortOptions: ["Group", "Name", "Tools"]
        }
      });
      const { sortOptions } = useSortOptions();

      expect(sortOptions.map(o => o.type)).toEqual(["Name", "Tools"]);
    });

    it("should still filter out Strategy when no override for Strategy is configured", () => {
      setupMockStores({
        sortWorkConfig: {
          sortOptions: ["Strategy", "Name", "Tools"]
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

});
