// The longest message a student can send the tutor. firestore.rules repeats it (rules cannot import),
// and firebase-test/src/chat-activity-rules.test.ts fails if the two drift.
export const kMaxChatMessageChars = 10_000;
