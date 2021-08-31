import { getSectionInitials, getSectionPlaceholder, getSectionTitle,
        kAllSectionType, SectionModel, registerSectionInfo, kDefaultPlaceholder } from "./section";

describe("SectionModel", () => {

  it("supports all/unknown section types by default", () => {
    expect(getSectionInitials("foo")).toBe("?");
    expect(getSectionTitle("foo")).toBe("Unknown");
    expect(getSectionPlaceholder("foo")).toBe(kDefaultPlaceholder);
    expect(getSectionInitials(kAllSectionType)).toBe("*");
    expect(getSectionTitle(kAllSectionType)).toBe("All");
    expect(getSectionPlaceholder(kAllSectionType)).toBe(kDefaultPlaceholder);

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
    expect(barSection.placeholder).toBe(kDefaultPlaceholder);

    expect(getSectionInitials(kAllSectionType)).toBe("*");
    expect(getSectionTitle(kAllSectionType)).toBe("All");
  });

});
