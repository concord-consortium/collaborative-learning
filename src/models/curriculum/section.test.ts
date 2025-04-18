import { getSectionInitials, getSectionPlaceholder, getSectionTitle,
        kAllSectionType, SectionModel, registerSectionInfo, findSectionIndex } from "./section";

describe("SectionModel", () => {

  it("supports all/unknown section types by default", () => {
    expect(getSectionInitials("foo")).toBe("?");
    expect(getSectionTitle("foo")).toBe("Unknown");
    expect(getSectionPlaceholder("foo")).toBe(undefined);
    expect(getSectionInitials(kAllSectionType)).toBe("*");
    expect(getSectionTitle(kAllSectionType)).toBe("All");
    expect(getSectionPlaceholder(kAllSectionType)).toBe(undefined);

    const section = SectionModel.create({ type: "foo" });
    expect(section.initials).toBe("?");
    expect(section.title).toBe("Unknown");
  });

  it("supports registerSectionInfo() to configure sections", () => {
    registerSectionInfo({ foo: { initials: "FS", title: "Foo Section", placeholder: "Foo Placeholder" } });

    const fooSection = SectionModel.create({ type: "foo" });
    expect(fooSection.initials).toBe("FS");
    expect(fooSection.title).toBe("Foo Section");
    expect(fooSection.placeholder).toBe("Foo Placeholder");

    const barSection = SectionModel.create({ type: "bar" });
    expect(barSection.initials).toBe("?");
    expect(barSection.title).toBe("Unknown");
    expect(barSection.placeholder).toBe(undefined);

    expect(getSectionInitials(kAllSectionType)).toBe("*");
    expect(getSectionTitle(kAllSectionType)).toBe("All");

    // ignores re-registration of the same info
    jestSpyConsole("warn", () => {
      registerSectionInfo({ foo: { initials: "SF", title: "Section Foo", placeholder: "Placeholder Foo" } });
    });
    const foo2Section = SectionModel.create({ type: "foo" });
    expect(foo2Section.initials).toBe("FS");
    expect(foo2Section.title).toBe("Foo Section");
    expect(foo2Section.placeholder).toBe("Foo Placeholder");
  });

});

describe("findSelectedSectionIndex", () => {
  it("finds section index", () => {
    const sections = [
      SectionModel.create({ type: "foo" }),
      SectionModel.create({ type: "bar" })
    ];

    expect(findSectionIndex(sections, "msa/1/1/foo")).toBe(0);
    expect(findSectionIndex(sections, "msa/1/1/bar")).toBe(1);
    expect(findSectionIndex(sections, "msa/1/1/baz")).toBe(-1);
    expect(findSectionIndex(sections, "invalid")).toBe(-1);
    expect(findSectionIndex(sections, undefined)).toBe(0);
  });
});
