import { getSnapshot } from "mobx-state-tree";
import { SupportsModel, SupportsModelType, SupportItemType } from "./supports";
import { UnitModel } from "./curriculum/unit";
import { SupportModel } from "./curriculum/support";
import { InvestigationModel } from "./curriculum/investigation";
import { ProblemModel } from "./curriculum/problem";
import { SectionModel, SectionType } from "./curriculum/section";
import { omitUndefined } from "../utilities/test-utils";

describe("supports model", () => {

  it("has default values", () => {
    const supports = SupportsModel.create({});
    expect(getSnapshot(supports)).toEqual({
      supports: [],
    });
  });

  it("uses override values", () => {
    const supports = SupportsModel.create({
      supports: [
        {text: "support #1", type: SupportItemType.unit, visible: true},
        {text: "support #2", type: SupportItemType.investigation},
        {text: "support #3", type: SupportItemType.problem, visible: true},
        {text: "support #4", type: SupportItemType.section},
      ]
    });
    expect(omitUndefined(getSnapshot(supports))).toEqual({
      supports: [
        {
          text: "support #1",
          type: "unit",
          visible: true,
        },
        {
          text: "support #2",
          type: "investigation",
          visible: false,
        },
        {
          text: "support #3",
          type: "problem",
          visible: true,
        },
        {
          text: "support #4",
          type: "section",
          visible: false,
        },
      ]
    });

    expect(supports.supports.filter((support) => support.visible).length).toEqual(2);
    supports.hideSupports();
    expect(supports.supports.filter((support) => support.visible).length).toEqual(0);
    supports.toggleSupport(supports.supports[0]);
    expect(supports.supports.filter((support) => support.visible).length).toEqual(1);
    expect(supports.supports[0].visible).toEqual(true);
  });

  it("can load supports from units", () => {
    const supports = SupportsModel.create({});
    const problem1 = ProblemModel.create({
      ordinal: 1,
      title: "Problem 1",
      sections: [
        SectionModel.create({
          type: SectionType.introduction,
          supports: [
            SupportModel.create({text: "support #1"}),
            SupportModel.create({text: "support #2"})
          ]
        }),
        SectionModel.create({
          type: SectionType.initialChallenge,
          supports: [
            SupportModel.create({text: "support #3"}),
            SupportModel.create({text: "support #4"})
          ]
        })
      ],
      supports: [
        SupportModel.create({text: "support #3"}),
        SupportModel.create({text: "support #4"})
      ]
    });
    const investigation1 = InvestigationModel.create({
      ordinal: 1,
      title: "Investigation 1",
      problems: [
        problem1,
        ProblemModel.create({
          ordinal: 2,
          title: "Problem 2",
          sections: [
            SectionModel.create({
              type: SectionType.introduction,
              supports: [
                SupportModel.create({text: "support #5"}),
                SupportModel.create({text: "support #6"})
              ]
            }),
            SectionModel.create({
              type: SectionType.initialChallenge,
              supports: [
                SupportModel.create({text: "support #7"}),
                SupportModel.create({text: "support #8"})
              ]
            })
          ],
          supports: [
            SupportModel.create({text: "support #9"}),
            SupportModel.create({text: "support #10"})
          ]
        })
      ],
      supports: [
        SupportModel.create({text: "support #11"}),
        SupportModel.create({text: "support #12"})
      ]
    });
    const investigation2 = InvestigationModel.create({
      ordinal: 1,
      title: "Investigation 2",
      problems: [
        ProblemModel.create({
          ordinal: 1,
          title: "Problem 1",
          sections: [
            SectionModel.create({
              type: SectionType.introduction,
              supports: [
                SupportModel.create({text: "support #13"}),
                SupportModel.create({text: "support #14"})
              ]
            }),
            SectionModel.create({
              type: SectionType.initialChallenge,
              supports: [
                SupportModel.create({text: "support #15"}),
                SupportModel.create({text: "support #16"})
              ]
            })
          ],
          supports: [
            SupportModel.create({text: "support #17"}),
            SupportModel.create({text: "support #18"})
          ]
        }),
        ProblemModel.create({
          ordinal: 2,
          title: "Problem 2",
          sections: [
            SectionModel.create({
              type: SectionType.introduction,
              supports: [
                SupportModel.create({text: "support #19"}),
                SupportModel.create({text: "support #20"})
              ]
            }),
            SectionModel.create({
              type: SectionType.initialChallenge,
              supports: [
                SupportModel.create({text: "support #21"}),
                SupportModel.create({text: "support #22"})
              ]
            })
          ],
          supports: [
            SupportModel.create({text: "support #23"}),
            SupportModel.create({text: "support #24"})
          ]
        })
      ],
      supports: [
        SupportModel.create({text: "support #25"}),
        SupportModel.create({text: "support #26"})
      ]
    });

    supports.createFromUnit(UnitModel.create({
      title: "Unit 1",
      investigations: [investigation1, investigation2],
      supports: [
        SupportModel.create({text: "support #27"}),
        SupportModel.create({text: "support #28"})
      ]
    }), investigation1, problem1);

    expect(supports.getAllForSection(SectionType.introduction)).toEqual([
      {
        sectionId: undefined,
        text: "support #27",
        type: "unit",
        visible: false
      },
      {
        sectionId: undefined,
        text: "support #28",
        type: "unit",
        visible: false
      },
      {
        sectionId: undefined,
        text: "support #11",
        type: "investigation",
        visible: false,
      },
      {
        sectionId: undefined,
        text: "support #12",
        type: "investigation",
        visible: false,
      },
      {
        sectionId: undefined,
        text: "support #3",
        type: "problem",
        visible: false,
      },
      {
        sectionId: undefined,
        text: "support #4",
        type: "problem",
        visible: false,
      },
      {
        sectionId: "introduction",
        text: "support #1",
        type: "section",
        visible: false,
      },
      {
        sectionId: "introduction",
        text: "support #2",
        type: "section",
        visible: false,
      }
    ]);
  });
});
