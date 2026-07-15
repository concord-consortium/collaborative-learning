import firebase from "firebase/app";
import { makeAutoObservable, ObservableMap, runInAction } from "mobx";
import { DB } from "../../lib/db";
import { escapeKey } from "../../lib/fire-utils";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";

// Firestore (partial) path for a class's teacher-added comment tags for one unit. Structured
// `commentTags/{classHash}/units/{unit}/tags` so security rules can class-scope reads by the
// {classHash} path segment. Custom tags are scoped to class + unit (not per problem) so they
// appear when sorting by tag at the Problem/Investigation/Unit levels.
// NOTE: the firestore.rules read rule compares the {classHash} path segment against the raw
// `class_hash` auth token, while this escapes it. Class hashes are alphanumeric so escapeKey is a
// no-op and they match; if that ever stops holding, the rule would need the same escaping.
export function customCommentTagsPath(classHash: string, unit: string) {
  return `commentTags/${escapeKey(classHash)}/units/${escapeKey(unit)}/tags`;
}

// A firestore-safe, stable id derived from a tag label, so re-adding the same label is idempotent
// and encourages tag hygiene (same label -> same tag).
export function commentTagId(label: string) {
  return escapeKey(label.trim().toLowerCase().replace(/\s+/g, "-"));
}

// Holds the teacher-added comment tags for the current class + unit, kept in sync by
// DBCommentTagsListener. Merged with the unit-config `commentTags` to form the effective tag list
// used by the comment picker, comment display, and Sort Work grouping.
export class CommentTags {
  db: DB;
  // id -> display label
  customTags = new ObservableMap<string, string>();

  constructor({ db }: { db: DB }) {
    makeAutoObservable(this, { db: false });
    this.db = db;
  }

  get customTagRecord(): Record<string, string> {
    return Object.fromEntries(this.customTags);
  }

  mergedWith(configTags?: Record<string, string>): Record<string, string> {
    return { ...(configTags ?? {}), ...this.customTagRecord };
  }

  replaceAll(entries: Array<[string, string]>) {
    runInAction(() => this.customTags.replace(new Map(entries)));
  }

  // Teacher-only: add a custom tag for the current class + unit. Writes to Firestore; the listener
  // syncs it back into `customTags` for every client in the class.
  async addTag(label: string, uid: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    const { classHash } = this.db.stores.user;
    const unit = this.db.stores.unit.code;
    // Throw (rather than silently succeed) so the caller surfaces its error state.
    if (!classHash || !unit) {
      throw new Error(`Cannot add comment tag: missing ${!classHash ? "classHash" : "unit"}`);
    }
    const id = commentTagId(trimmed);
    const ref = this.db.firestore.collection(customCommentTagsPath(classHash, unit)).doc(id);
    await ref.set({
      id,
      label: trimmed,
      classHash,
      unit,
      createdBy: uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    Logger.log(LogEventName.CREATE_CUSTOM_COMMENT_TAG, { tagName: trimmed, tagId: id, unit, classHash });
  }
}
