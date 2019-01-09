import { getSnapshot } from "mobx-state-tree";
import { SupportsModel, SupportItemType, SupportAudienceType, TeacherSupportModel } from "./supports";
import { UnitModel } from "../curriculum/unit";
import { SupportModel } from "../curriculum/support";
import { InvestigationModel } from "../curriculum/investigation";
import { ProblemModel } from "../curriculum/problem";
import { SectionType } from "../curriculum/section";
import { omitUndefined } from "../../utilities/test-utils";
import { cloneDeep } from "lodash";

describe("supports model", () => {

  it("has default values", () => {
    const supports = SupportsModel.create({});
    expect(getSnapshot(supports)).toEqual({
      curricularSupports: [],
      teacherSupports: []
    });
  });

  it("uses override values", () => {
    const supports = SupportsModel.create({
      curricularSupports: [
        {text: "support #1", type: SupportItemType.unit, visible: true},
        {text: "support #2", type: SupportItemType.investigation},
        {text: "support #3", type: SupportItemType.problem, visible: true},
        {text: "support #4", type: SupportItemType.section},
      ],
      teacherSupports: [
        {key: "1", text: "support #5", type: SupportItemType.problem,
          audience: SupportAudienceType.class, authoredTime: 42}
      ]
    });
    expect(omitUndefined(getSnapshot(supports))).toEqual({
      curricularSupports: [
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
      ],
      teacherSupports: [
        {
          key: "1",
          text: "support #5",
          type: "problem",
          audience: "class",
          authoredTime: 42,
          visible: false,
          deleted: false
        }
      ]
    });

    expect(supports.curricularSupports.filter((support) => support.visible).length).toEqual(2);
    supports.hideSupports();
    expect(supports.curricularSupports.filter((support) => support.visible).length).toEqual(0);
    supports.toggleSupport(supports.curricularSupports[0]);
    expect(supports.curricularSupports.filter((support) => support.visible).length).toEqual(1);
    expect(supports.curricularSupports[0].visible).toEqual(true);
  });

  it("can load supports from units", () => {
    const supports = SupportsModel.create({});
    const problem1 = {
      ordinal: 1,
      title: "Problem 1",
      sections: [
        {
          type: SectionType.introduction,
          supports: [
            SupportModel.create({text: "Investigation 1, Problem 1, section: introduction, support #1"}),
            SupportModel.create({text: "Investigation 1, Problem 1, section: introduction, support #2"})
          ]
        },
        {
          type: SectionType.initialChallenge,
          supports: [
            SupportModel.create({text: "Investigation 1, Problem 1, section: initial challenge, support #1"}),
            SupportModel.create({text: "Investigation 1, Problem 1, section: initial challenge, support #2"})
          ]
        }
      ],
      supports: [
        SupportModel.create({text: "Investigation 1, Problem 1, support #1"}),
        SupportModel.create({text: "Investigation 1, Problem 1, support #2"})
      ]
    };
    const investigation1 = {
      ordinal: 1,
      title: "Investigation 1",
      problems: [
        problem1,
        {
          ordinal: 2,
          title: "Problem 2",
          sections: [
            {
              type: SectionType.introduction,
              supports: [
                SupportModel.create({text: "Investigation 1, Problem 2, section: introduction, support #1"}),
                SupportModel.create({text: "Investigation 1, Problem 2, section: introduction, support #2"})
              ]
            },
            {
              type: SectionType.initialChallenge,
              supports: [
                SupportModel.create({text: "Investigation 1, Problem 2, section: initial challenge, support #1"}),
                SupportModel.create({text: "Investigation 1, Problem 2, section: initial challenge, support #2"})
              ]
            }
          ],
          supports: [
            SupportModel.create({text: "Investigation 1, Problem 1, support #1"}),
            SupportModel.create({text: "Investigation 1, Problem 1, support #2"})
          ]
        }
      ],
      supports: [
        SupportModel.create({text: "Investigation 1, support #1"}),
        SupportModel.create({text: "Investigation 1, support #2"})
      ]
    };
    const investigation2 = {
      ordinal: 1,
      title: "Investigation 2",
      problems: [
        {
          ordinal: 1,
          title: "Problem 1",
          sections: [
            {
              type: SectionType.introduction,
              supports: [
                SupportModel.create({text: "Investigation 2, Problem 1, section: introduction, support #1"}),
                SupportModel.create({text: "Investigation 2, Problem 1, section: introduction, support #2"})
              ]
            },
            {
              type: SectionType.initialChallenge,
              supports: [
                SupportModel.create({text: "Investigation 2, Problem 1, section: initial challenge, support #1"}),
                SupportModel.create({text: "Investigation 2, Problem 1, section: initial challenge, support #2"})
              ]
            }
          ],
          supports: [
            SupportModel.create({text: "Investigation 2, Problem 1, support #1"}),
            SupportModel.create({text: "Investigation 2, Problem 1, support #2"})
          ]
        },
        {
          ordinal: 2,
          title: "Problem 2",
          sections: [
            {
              type: SectionType.introduction,
              supports: [
                SupportModel.create({text: "Investigation 2, Problem 2, section: introduction, support #1"}),
                SupportModel.create({text: "Investigation 2, Problem 2, section: introduction, support #2"})
              ]
            },
            {
              type: SectionType.initialChallenge,
              supports: [
                SupportModel.create({text: "Investigation 2, Problem 2, section: initial challenge, support #1"}),
                SupportModel.create({text: "Investigation 2, Problem 2, section: initial challenge, support #2"})
              ]
            }
          ],
          supports: [
            SupportModel.create({text: "Investigation 2, Problem 2, support #1"}),
            SupportModel.create({text: "Investigation 2, Problem 2, support #2"})
          ]
        }
      ],
      supports: [
        SupportModel.create({text: "Investigation 2, support #1"}),
        SupportModel.create({text: "Investigation 2, support #2"})
      ]
    };

    supports.createFromUnit(UnitModel.create({
      title: "Unit 1",
      investigations: [investigation1, investigation2],
      supports: [
        SupportModel.create({text: "Unit 1, support #1"}),
        SupportModel.create({text: "Unit 1, support #2"})
      ]
    }), InvestigationModel.create(cloneDeep(investigation1)),
        ProblemModel.create(cloneDeep(problem1)));

    expect(supports.getAllForSection(SectionType.introduction)).toEqual([
      {
        sectionId: "introduction",
        text: "Investigation 1, Problem 1, section: introduction, support #1",
        type: "section",
        visible: false,
      },
      {
        sectionId: "introduction",
        text: "Investigation 1, Problem 1, section: introduction, support #2",
        type: "section",
        visible: false,
      }
    ]);
  });

  it("sorts authored supports correctly", () => {
    const supports = SupportsModel.create({});
    const earlySupport = TeacherSupportModel.create({
      key: "1",
      text: "foo",
      type: SupportItemType.problem,
      audience: SupportAudienceType.class,
      authoredTime: 100
    });
    const lateSupport = TeacherSupportModel.create({
      key: "2",
      text: "bar",
      type: SupportItemType.problem,
      audience: SupportAudienceType.class,
      authoredTime: 200
    });

    expect(getSnapshot(supports)).toEqual({
      curricularSupports: [],
      teacherSupports: []
    });
    supports.setAuthoredSupports([lateSupport, earlySupport]);
    expect(getSnapshot(supports)).toEqual({
      curricularSupports: [],
      teacherSupports: [earlySupport, lateSupport]
    });
  });
});
