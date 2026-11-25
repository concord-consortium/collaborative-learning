// The longest message a student can send the tutor. firestore.rules repeats it (rules cannot import),
// and functions-v2/test/chat-activity-rules.test.ts fails if the two drift.
export const kMaxChatMessageChars = 10_000;
