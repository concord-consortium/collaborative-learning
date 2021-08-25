/*
 * This document represents the Firestore schema with TypeScript types and interface definitions.
 * For now these should be considered documentation, although they may eventually be useful in code.
 * As of this writing, the domain-related and supports-related aspects are already implemented, while
 * the comment-related and network-related aspects are being planned.
 * Where relevant, synchronization issues are noted. These are situations in which we will store
 * information in Firestore that is replicated from elsewhere and which could potentially change,
 * in which case we would need to have a mechanism for synchronizing that change. For instance,
 * if a new teacher is added to a class, we would want to reflect that in our classes subcollection.
 */
// represents a Firestore subcollection
type FSCollection<IDocument> = Record<string, IDocument>;
// represents a Firestore timestamp
type FSDate = Date;

/*
 * users
 *
 * Subcollection of domain with some fields copied from portal (e.g. name) with potential synchronization issues.
 * At least initially, the list of networks a teacher is a part of will be maintained manually by editing in the
 * Firestore console. It is anticipated that the numbers of teachers and networks will be small.
 */
interface UserDocument {
  uid: string;                // portal user id
  name: string;               // teacher name
  type: string;               // "teacher" for now although maybe students eventually
  networks: string[];         // ids of networks this teacher is part of
}
// collection key is portal uid
type UsersCollection = FSCollection<UserDocument>;

/*
 * comments
 *
 * Subcollection of documents with a denormalized teacher name field with potential synchronization issues.
 * Comments associated with a document are accessible to any user with access to the document.
 */
export interface CommentDocument {
  uid: string;                // user id of author of comment
  name: string;               // [denormalized] name of user to avoid having to request user data separately
  network?: string;           // [denormalized] teacher network of containing document for network-wide queries
  createdAt: FSDate;          // timestamp used for sorting
  tileId?: string;            // empty for document comments
  content: string;            // plain text for now; potentially html if we need rich text
}
// collection key is Firestore-assigned id
type CommentsCollection = FSCollection<CommentDocument>;

/*
 * documents
 *
 * Subcollection of domain with several metadata fields copied from real-time database (e.g. title, properties)
 * with potential synchronization issues.
 * Documents and their comments are accessible to the owning teacher in addition to any network access.
 * Documents owned by one teacher are accessible to all teachers that share a network with the owner.
 * Networked access will be mediated by Firestore security rules which can check whether the requesting user and
 * one of the teachers of the class associated with the document share a network.
 */
interface DocumentDocument {
  context_id: string;                 // class hash for document context
  teachers: string[];                 // [denormalized] uids of teachers of class
  network: string;                    // (current) network of teacher creating document
  uid: string;                        // original document owner (could be student)
  type: string;                       // original document type
  key: string;                        // original document key (id)
  createdAt: FSDate;                  // original document timestamp
  title?: string;                     // original document title
  properties: Record<string, string>; // original document properties
  comments: CommentsCollection;       // comments/chats subcollection
}
// collection key is {network}_{id in Firebase Real-time Database} because
// the same document might get added in different networks over time
type DocumentsCollection = FSCollection<DocumentDocument>;

/*
 * classes
 *
 * Subcollection of domain with several fields copied from portal (e.g. name, teachers) with
 * potential synchronization issues.
 * Class resources are accessible to other teachers that share a network with one of the teachers of the class.
 * Networked access will be mediated by Firestore security rules which can check whether the requesting user and
 * one of the teachers of the class share a network.
 */
interface ClassDocument {
  id: string;                 // portal class id
  name: string;               // portal class name
  context_id: string;         // portal class hash
  teachers: string[];         // uids of teachers of class
  network: string;            // network of teacher creating class
}
// collection key is context_id (class hash)
type ClassesCollection = FSCollection<ClassDocument>;

/*
 * networks
 *
 * Subcollection of domain with very little in it. We could try to store a list of users or classes in network
 * but this would just create synchronization headaches. It seems better to query for those things, at least
 * initially. I considered making some collections like classes subcollections of networks, but in each case
 * it seemed like there might be value in being able to access them without going through the network.
 */
interface NetworkDocument {
  id: string;                 // admin-defined, e.g. "msu-1", because they will need to be hand-entered initially
  name: string;               // the user-visible full name of the network
  shortName: string;          // abbreviated name for use in compact displays
}
// collection key is id, e.g. "msu-1"
type NetworksCollection = FSCollection<NetworkDocument>;

/*
 * mcsupports
 *
 * Preexisting subcollection of domain used to implement multi-class supports.
 */
interface SupportDocument {
  classes: string[];          // array of class hashes that can access the support
  content: string;            // JSON stringified content of support
  context_id: string;         // class hash of class in which support was created
  createdAt: FSDate;          // timestamp
  network: string;            // (current) network of teacher creating support document
                              // seems useful to add for consistency; migration required for older supports
  originDoc: string;          // id of document from which the support was published
  platform_id: string;        // portal, e.g. "learn.concord.org"
  problem: string;            // e.g. "msa/2/1"
  properties: {
    caption: string;          // e.g. "MSA 2.1 Problem Title"
    teacherSupport: boolean;
  };
  resource_link_id: string;   // offering id
  resource_url: string;       // e.g. "https://collaborative-learning.concord.org/?unit=msa&problem=2.1"
  type: string;               // e.g. "supportPublication"
  uid: string;                // user id of teacher that created the support
}
type SupportsCollection = FSCollection<SupportDocument>;

/*
 * A domain represents the set of resources available within a specific domain.
 * All access is restricted by the domain, i.e. users in one domain can only access resources in that domain.
 */
interface DomainDocument {
  users: UsersCollection;
  networks: NetworksCollection;
  classes: ClassesCollection;
  documents: DocumentsCollection;
  mcsupports: SupportsCollection;
  updatedAt: FSDate;
}
// key is the domain name, e.g. `learn_concord_org` is a key in the `authed` subcollection
type DomainCollection = FSCollection<DomainDocument>;

/*
 * Root contains top-level collections for each domain group, e.g. `authed` for portal domains.
 * Security rules are strictest for the `authed` domain and more relaxed for the others.
 */
export interface FirestoreRoot {
  authed: DomainCollection;
  demo: DomainCollection;
  dev: DomainCollection;
  qa: DomainCollection;
}
