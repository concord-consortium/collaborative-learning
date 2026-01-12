# CLUE Document Types

## Introduction

In the beginning there were only a few types of documents but over time more have been added with different purposes, scopes, metadata, locations in the database, etc. This document is an attempt to gather information about the various document types in one place.

For reasons harking back to the limitations of the Firebase realtime database, documents are generally stored in three pieces in the database. The content of a document is separated from its metadata so that they can be listed without downloading their full contents. (Realtime database queries are deep, i.e. a request for a record at a given path returns all information below that path.) Furthermore, metadata is generally split between generic metadata which is identical for all documents and type-specific metadata to make it easier to find documents of a given type. A consequence of this, however, is that three writes are required for each document and three reads are required to find and load individual document contents.

All of the contents of the realtime database for a given class are stored at a path like `/{firebaseRoot}/classes/{classHash}`, where the `{firebaseRoot}` depends on the `appMode` and other environmental factors. For the remainder of this document we will refer to this as the `/{classPath}` for brevity.

## Generic Document Metadata

The content and generic metadata for all documents associated with the user's work in a given class is stored at `/{classPath}/users/{userId}/documents` and `/{classPath}/users/{userId}/documentMetadata`. Additional type-specific metadata is stored elsewhere to make it easier to find documents of specific types associated with specific problems, for instance.

The document metadata at `/{classPath}/users/{userId}/documentMetadata` [is typed as](/src/lib/db-types.ts):
```typescript
export type DBDocumentType = "section" |  // section documents are deprecated
                              "problem" | "planning" | "publication" |
                              "personal" | "personalPublication" |
                              "learningLog" | "learningLogPublication" |
                              "supportPublication";

export interface DBBaseDocumentMetadata {
  version: "1.0";
  self: {
    uid: string;
    classHash: string;
    documentKey: string;
  };
  createdAt: number;
  type: DBDocumentType;
  // previously in DBOtherDocument
  properties?: IDocumentProperties;
  visibility?: "public" | "private";
}

export interface DBBaseProblemDocumentMetadata extends DBBaseDocumentMetadata {
  classHash: string;
  offeringId: string;
}
```

Document contents at `/{classPath}/users/{userId}/documents` [is typed as](/src/lib/db-types.ts):
```typescript
export interface DBDocument {
  version: "1.0";
  self: {
    uid: string;
    documentKey: string;
    classHash: string;
  };
  content?: string;
  changeCount?: number;
  type: DBDocumentType;
}
```

In each case, the same `documentKey` is used, so the metadata is stored at `/{classPath}/users/{userId}/documentMetadata/{documentKey}` and the contents are stored at `/{classPath}/users/{userId}/documents/{documentKey}`.

## Problem/Planning Documents

Every user (student or teacher) has a problem document created for them the first time they launch CLUE for a given problem (e.g. Stretching and Shrinking 1.2). This is meant to be their primary workspace for that problem. It is a sectioned document with sections defined in the JSON for the curriculum unit, although currently all curriculum units share the same sections (Introduction, Initial Challenge, ...). For students, this document can be shared with other members of their group via the four-up view. A student can control the visibility of the problem document to the group by sharing/unsharing the document. Type-specific metadata for the problem document is stored at `/{classPath}/offerings/{offeringId}/users/{userId}/documents`. By convention there is only one such document, but there's nothing at the database level that enforces that constraint and bugs have been known to result in multiple problem document instances.

Teachers (not students) also have a planning document created for them the first time they launch CLUE for a given problem. This is meant to be a workspace in which teachers make notes for themselves for use when teaching the particular problem. The planning document is also a sectioned document with sections defined in the JSON for the curriculum content, but the sections are different than for problem documents (Overview, Launch, Explore, Summarize). Type-specific metadata for the planning document is stored at `/{classPath}/offerings/{offeringId}/users/{userId}/planning`. By convention there is only one such document, but there's nothing at the database level that enforces that constraint.

Type-specific metadata for problem/planning documents is typed as:
```typescript
export interface DBOfferingUserProblemDocument {
  version: "1.0";
  self: {
    classHash: string;
    offeringId: string;
    uid: string;
  };
  visibility: "public" | "private";
  documentKey: string; // firebase id of portal user document
}
```

Note that only problem/planning documents have the `visibility` property, intended to support group sharing of problem documents in the four-up view.

## Personal/Learning Log Documents

Personal documents and learning logs are user-specific documents that are available across problems/offerings. As such, they can be used to make notes on things learned in one problem that are carried over to another problem and to aid in transferring document content between problems. Type-specific metadata for personal documents is stored at `/{classPath}/users/{userId}/personalDocs` and for learning logs at `/{classPath}/users/{userId}/learningLogs`. Originally, users were limited to a single learning log document, but that has since been relaxed so that now users can create as many personal documents or learning logs as they want. (At this point personal documents and learning logs function almost identically, and so a reasonable argument can be made for combining them.)

Type-specific metadata for personal documents and learning logs is typed as:
```typescript
export interface DBOtherDocument {
  version: "1.0";
  self: {
    uid: string;
    classHash: string;
    documentKey: string;
  };
  title: string;
  // legacy properties; in DBBaseDocumentMetadata since ~2.2
  properties?: IDocumentProperties;
}
```

Note that only personal documents and learning logs have the `title` property (other document types are given titles automatically) and the `properties` property, which is used to store additional information like whether or not the document has been "deleted" by the user (i.e. should be hidden in the UI).

## Group Documents

We are in the process of adding a new group document type. These documents will be editable by all members of a group. They are stored under a virtual group user in standard place. This virtual group user has the form `group_{offering_id}_{group_id}`.

The group documents rely on the Firestore metadata. The Realtime Database metadata is maintained for consistency and so firebase functions which are watching properties in this metadata work properly with group documents.

## Publications

The user has the option of publishing many of the preceding document types for the whole class. Under the hood, a published document is just a read-only copy of the document with some additional metadata, e.g. the `originDoc`, which indicates the id of the document from which it was published. A user can publish a given document multiple times, resulting in multiple versions of the published document. By convention, only the most recent version of a given publication is shown in the UI, but all published versions are (currently) maintained internally.

### Published Problem Documents

Type-specific metadata for published problem documents is stored at `/{classPath}/offerings/{offeringId}/publications`.
For published problem documents, the same `documentKey` is used for the key of the type-specific metadata as is used for the common metadata and the document contents.

Type-specific metadata for published problem documents is typed as:
```typescript
export interface DBPublication {
  version: "1.0";
  self: {
    classHash: string;
    offeringId: string;
  };
  documentKey: string;
  groupId?: string;
  userId: string;
  groupUserConnections?: DBGroupUserConnections;
  pubVersion: number;
}
```

### Published Personal and Learning Log Documents

Type-specific metadata for published personal documents is stored at `/{classPath}/personalPublications`.
Type-specific metadata for published learning log documents is stored at `/{classPath}/publications` (which seems like an oddly generic name, but was probably the only type of document that could be published to the root of the class at the time that the ability to publish learning logs was implemented).

Type-specific metadata for published personal and learning log documents is typed as:
```typescript
export interface DBOtherPublication {
  version: "1.0";
  self: {
    classHash: string;
    documentKey: string;
  };
  title: string;
  properties: IDocumentProperties;
  uid: string;
  originDoc: string;
  pubVersion: number
}
```

For reasons that have been lost to history (but were probably inadvertent), published personal documents and learning logs use a unique `documentKey` as the key of the type-specific metadata and the corresponding `documentKey` for the common metadata and the document contents must be retrieved from the `self/documentKey` property. ¯\\_(ツ)_/¯

### Published Multi-class Support Documents

The ability to publish documents as multi-class supports is a relatively recent addition designed to make it possible for teachers of multiple classes to disseminate content to all of their classes. Toward this end, published multi-class supports are stored in firestore (not the realtime database) where the more advanced security rules are utilized to enable access from multiple classes.
