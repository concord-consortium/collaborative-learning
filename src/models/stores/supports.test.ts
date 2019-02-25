import { getSnapshot } from "mobx-state-tree";
import { SupportsModel, SupportItemType, AudienceEnum, TeacherSupportModel, ClassAudienceModel, GroupAudienceModel,
  UserAudienceModel, TeacherSupportModelType } from "./supports";
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
      classSupports: [],
      userSupports: [],
      groupSupports: []
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
      classSupports: [
        {key: "1", text: "support #5", type: SupportItemType.problem,
          audience: ClassAudienceModel.create(), authoredTime: 42}
      ]
    });
    expect(omitUndefined(getSnapshot(supports))).toEqual({
      curricularSupports: [
        {
          supportType: "curricular",
          text: "support #1",
          type: "unit",
          visible: true,
        },
        {
          supportType: "curricular",
          text: "support #2",
          type: "investigation",
          visible: false,
        },
        {
          supportType: "curricular",
          text: "support #3",
          type: "problem",
          visible: true,
        },
        {
          supportType: "curricular",
          text: "support #4",
          type: "section",
          visible: false,
        },
      ],
      classSupports: [
        {
          key: "1",
          supportType: "teacher",
          text: "support #5",
          type: "problem",
          audience: {
            type: "class"
          },
          authoredTime: 42,
          visible: false,
          deleted: false
        }
      ],
      groupSupports: [],
      userSupports: []
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

    expect(supports.getSupportsForUserProblem(SectionType.introduction, "groupId", "userId")).toEqual([
      {
        sectionId: "introduction",
        supportType: "curricular",
        text: "Investigation 1, Problem 1, section: introduction, support #1",
        type: "section",
        visible: false,
      },
      {
        sectionId: "introduction",
        supportType: "curricular",
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
      audience: ClassAudienceModel.create(),
      authoredTime: 100
    });
    const lateSupport = TeacherSupportModel.create({
      key: "2",
      text: "bar",
      type: SupportItemType.problem,
      audience: ClassAudienceModel.create(),
      authoredTime: 200
    });

    expect(getSnapshot(supports)).toEqual({
      curricularSupports: [],
      classSupports: [],
      groupSupports: [],
      userSupports: []
    });
    supports.setAuthoredSupports([lateSupport, earlySupport], AudienceEnum.class);
    expect(getSnapshot(supports)).toEqual({
      curricularSupports: [],
      classSupports: [earlySupport, lateSupport],
      groupSupports: [],
      userSupports: []
    });
  });

  it("Gets supports by audience and section type", () => {
    const classSupportAll = {key: "1", text: "", type: SupportItemType.problem,
      audience: ClassAudienceModel.create(), authoredTime: 42};
    const classSupportIntro = {key: "2", text: "", type: SupportItemType.section, sectionId: SectionType.introduction,
      audience: ClassAudienceModel.create(), authoredTime: 43};
    const groupSupport = {key: "3", text: "", type: SupportItemType.problem,
      audience: GroupAudienceModel.create({identifier: "group1"}), authoredTime: 44};
    const userSupport = {key: "4", text: "", type: SupportItemType.section, sectionId: SectionType.didYouKnow,
      audience: UserAudienceModel.create({identifier: "user1"}), authoredTime: 45};

    const supports = SupportsModel.create({
      classSupports: [
        classSupportAll,
        classSupportIntro
      ],
      groupSupports: [
        groupSupport
      ],
      userSupports: [
        userSupport
      ]
    });

    const generalClassSupports = supports.getSupportsForUserProblem(SectionType.didYouKnow, "group0", "user0");
    expect(generalClassSupports.length).toEqual(1);
    expect((generalClassSupports[0] as TeacherSupportModelType).key).toEqual(classSupportAll.key);

    const setionClassSupports = supports.getSupportsForUserProblem(SectionType.introduction, "group0", "user0");
    expect(setionClassSupports.length).toEqual(2);
    expect((setionClassSupports[0] as TeacherSupportModelType).key).toEqual(classSupportAll.key);
    expect((setionClassSupports[1] as TeacherSupportModelType).key).toEqual(classSupportIntro.key);

    const groupSupports = supports.getSupportsForUserProblem(SectionType.didYouKnow, "group1", "user0");
    expect(groupSupports.length).toEqual(2);
    expect((groupSupports[0] as TeacherSupportModelType).key).toEqual(classSupportAll.key);
    expect((groupSupports[1] as TeacherSupportModelType).key).toEqual(groupSupport.key);

    const userSupports = supports.getSupportsForUserProblem(SectionType.didYouKnow, "group0", "user1");
    expect(userSupports.length).toEqual(2);
    expect((userSupports[0] as TeacherSupportModelType).key).toEqual(classSupportAll.key);
    expect((userSupports[1] as TeacherSupportModelType).key).toEqual(userSupport.key);

    const multiSupports = supports.getSupportsForUserProblem(SectionType.didYouKnow, "group1", "user1");
    expect(multiSupports.length).toEqual(3);
    expect((multiSupports[0] as TeacherSupportModelType).key).toEqual(classSupportAll.key);
    expect((multiSupports[1] as TeacherSupportModelType).key).toEqual(groupSupport.key);
    expect((multiSupports[2] as TeacherSupportModelType).key).toEqual(userSupport.key);
  });
});
