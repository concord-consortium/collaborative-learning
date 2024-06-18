import { getSnapshot } from "mobx-state-tree";
import { SupportsModel, SupportTarget, AudienceEnum, TeacherSupportModel, ClassAudienceModel, GroupAudienceModel,
  UserAudienceModel,
  TeacherSupportModelType} from "./supports";
import { createTextSupport, ESupportType, createStickyNote } from "../curriculum/support";
import { omitUndefined } from "../../utilities/test-utils";

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
        {support: {type: ESupportType.text, content: "support #1"}, type: SupportTarget.unit, visible: true},
        {support: {type: ESupportType.text, content: "support #2"}, type: SupportTarget.investigation},
        {support: {type: ESupportType.text, content: "support #3"}, type: SupportTarget.problem, visible: true},
        {support: {type: ESupportType.text, content: "support #4"}, type: SupportTarget.section},
      ],
      classSupports: [
        {uid: "1", key: "1", support: {type: ESupportType.text, content: "support #5"}, type: SupportTarget.problem,
          audience: ClassAudienceModel.create(), authoredTime: 42}
      ]
    });
    expect(omitUndefined(getSnapshot(supports))).toEqual({
      curricularSupports: [
        {
          supportType: "curricular",
          support: {type: ESupportType.text, content: "support #1"},
          type: "unit",
          visible: true,
        },
        {
          supportType: "curricular",
          support: {type: ESupportType.text, content: "support #2"},
          type: "investigation",
          visible: false,
        },
        {
          supportType: "curricular",
          support: {type: ESupportType.text, content: "support #3"},
          type: "problem",
          visible: true,
        },
        {
          supportType: "curricular",
          support: {type: ESupportType.text, content: "support #4"},
          type: "section",
          visible: false,
        },
      ],
      classSupports: [
        {
          uid: "1",
          key: "1",
          supportType: "teacher",
          support: {type: ESupportType.text, content: "support #5"},
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

  it("sorts authored supports correctly", () => {
    const supports = SupportsModel.create({});
    const earlySupport = TeacherSupportModel.create({
      uid: "1",
      key: "1",
      support: createTextSupport("foo"),
      type: SupportTarget.problem,
      audience: ClassAudienceModel.create(),
      authoredTime: 100
    });
    const lateSupport = TeacherSupportModel.create({
      uid: "1",
      key: "2",
      support: createTextSupport("bar"),
      type: SupportTarget.problem,
      audience: ClassAudienceModel.create(),
      authoredTime: 200
    });

    expect(getSnapshot(supports)).toEqual({
      curricularSupports: [],
      classSupports: [],
      groupSupports: [],
      userSupports: []
    });
    supports.addAuthoredSupports([lateSupport, earlySupport], AudienceEnum.class);
    expect(getSnapshot(supports)).toEqual({
      curricularSupports: [],
      classSupports: [earlySupport, lateSupport],
      groupSupports: [],
      userSupports: []
    });
  });

  it("Gets supports by audience and section type", () => {
    const classSupportAll = {uid: "1", key: "1", support: createTextSupport(""), type: SupportTarget.problem,
      audience: ClassAudienceModel.create(), authoredTime: 42};
    const classSupportIntro = {uid: "1", key: "2", support: createTextSupport(""),
      type: SupportTarget.section, sectionId: "introduction",
      audience: ClassAudienceModel.create(), authoredTime: 43};
    const groupSupport = {uid: "1", key: "3", support: createTextSupport(""), type: SupportTarget.problem,
      audience: GroupAudienceModel.create({identifier: "group1"}), authoredTime: 44};
    const userSupport = {uid: "1", key: "4", support: createTextSupport(""),
      type: SupportTarget.section, sectionId: "didYouKnow",
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

    const generalClassSupports = supports.getSupportsForUserProblem(
                                  { sectionId: "didYouKnow", groupId: "group0", userId: "user0" });
    expect(generalClassSupports.length).toEqual(1);
    expect((generalClassSupports[0] as TeacherSupportModelType).key).toEqual(classSupportAll.key);

    const sectionClassSupports = supports.getSupportsForUserProblem(
                                  { sectionId: "introduction", groupId: "group0", userId: "user0" });
    expect(sectionClassSupports.length).toEqual(2);
    expect((sectionClassSupports[0] as TeacherSupportModelType).key).toEqual(classSupportAll.key);
    expect((sectionClassSupports[1] as TeacherSupportModelType).key).toEqual(classSupportIntro.key);

    const groupSupports = supports.getSupportsForUserProblem(
                            { sectionId: "didYouKnow", groupId: "group1", userId: "user0" });
    expect(groupSupports.length).toEqual(2);
    expect((groupSupports[0] as TeacherSupportModelType).key).toEqual(classSupportAll.key);
    expect((groupSupports[1] as TeacherSupportModelType).key).toEqual(groupSupport.key);

    const userSupports = supports.getSupportsForUserProblem(
                            { sectionId: "didYouKnow", groupId: "group0", userId: "user1" });
    expect(userSupports.length).toEqual(2);
    expect((userSupports[0] as TeacherSupportModelType).key).toEqual(classSupportAll.key);
    expect((userSupports[1] as TeacherSupportModelType).key).toEqual(userSupport.key);

    const multiSupports = supports.getSupportsForUserProblem(
                            { sectionId: "didYouKnow", groupId: "group1", userId: "user1" });
    expect(multiSupports.length).toEqual(3);
    expect((multiSupports[0] as TeacherSupportModelType).key).toEqual(classSupportAll.key);
    expect((multiSupports[1] as TeacherSupportModelType).key).toEqual(groupSupport.key);
    expect((multiSupports[2] as TeacherSupportModelType).key).toEqual(userSupport.key);
  });

  it("queries for sticky notes", () => {
    const nonStickySupport = {uid: "1", key: "4", support: createTextSupport(""),
      type: SupportTarget.section, sectionId: "didYouKnow",
      audience: UserAudienceModel.create({identifier: "user1"}), authoredTime: 45};
    const stickyNote = {uid: "1", key: "4",
      support: createStickyNote("Message", "Exemplar ID"),
      type: SupportTarget.section, sectionId: "",
      audience: UserAudienceModel.create({identifier: "user1"}), authoredTime: 45};
    const supports = SupportsModel.create({ userSupports: [ nonStickySupport, stickyNote ] });

    expect(supports.getStickyNoteForUserWithLink("user1", "Exemplar ID")).toMatchObject({
      type: "section",
      support: {
        mode: "sticky"
      }
    });
    expect(supports.getStickyNoteForUserWithLink("user4", "Exemplar ID")).toBeFalsy();
  });
});
