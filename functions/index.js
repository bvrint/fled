/**
 * Firebase Cloud Functions - Notification triggers for FLED
 */

const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {setGlobalOptions} = require("firebase-functions/v2/options");
const admin = require("firebase-admin");

// Configure defaults
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

// Initialize Admin SDK
try {
	admin.initializeApp();
} catch (_e) {}

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Helper: normalize tokens from a parent document.
 * Supports either `fcmToken` (string) or `fcmTokens` (array of strings).
 */
function extractTokensFromParentDoc(docSnap) {
	if (!docSnap || !docSnap.exists) return [];
	const data = docSnap.data() || {};
	const tokens = [];
	if (typeof data.fcmToken === "string" && data.fcmToken.trim()) {
		tokens.push(data.fcmToken.trim());
	}
	if (Array.isArray(data.fcmTokens)) {
		for (const t of data.fcmTokens) {
			if (typeof t === "string" && t.trim()) tokens.push(t.trim());
		}
	}
	return Array.from(new Set(tokens));
}

/**
 * Helper: fetch parent tokens for a sectionId.
 * 1) Find students where sectionId == given
 * 2) Collect parentId(s)
 * 3) Load each parent and extract tokens
 */
async function getTokensForSection(sectionId) {
	if (!sectionId) return [];
	const tokens = new Set();
	const studentsSnap = await db.collection("students").where("sectionId", "==", sectionId).get();
	const parentIds = new Set();
	studentsSnap.forEach((s) => {
		const d = s.data();
		if (d && d.parentId) parentIds.add(d.parentId);
	});
	if (parentIds.size === 0) return [];
	const gets = Array.from(parentIds).map((pid) => db.collection("parents").doc(pid).get());
	const parentDocs = await Promise.all(gets);
	for (const p of parentDocs) {
		for (const t of extractTokensFromParentDoc(p)) tokens.add(t);
	}
	return Array.from(tokens);
}

/**
 * Helper: fetch parent tokens for a specific parentId.
 */
async function getTokensForParent(parentId) {
	if (!parentId) return [];
	const doc = await db.collection("parents").doc(parentId).get();
	return extractTokensFromParentDoc(doc);
}

/**
 * Helper: send a notification to many tokens (chunked for safety)
 */
async function sendNotificationToTokens(title, body, data, tokens) {
	if (!tokens || tokens.length === 0) return { sent: 0 };
	const chunkSize = 450; // FCM limit is 500; leave headroom
	let sent = 0;
	for (let i = 0; i < tokens.length; i += chunkSize) {
		const chunk = tokens.slice(i, i + chunkSize);
		const message = {
			notification: { title, body },
			data: data || {},
			tokens: chunk,
		};
		const resp = await messaging.sendEachForMulticast(message);
		sent += resp.successCount || 0;
	}
	return { sent };
}

/**
 * Trigger: on new Task created → notify parents of the section
 * tasks doc expected shape: { title, type, deadline, description, sectionId, ownerUid, createdAt }
 */
exports.notifyOnTaskCreated = onDocumentCreated("tasks/{taskId}", async (event) => {
	const snap = event.data;
	if (!snap) return;
	const task = snap.data();
	if (!task || !task.sectionId) return;

	const tokens = await getTokensForSection(task.sectionId);
	if (!tokens.length) return;

	const title = `New ${task.type || "Task"}`;
	const body = task.title ? `${task.title}${task.deadline ? " · Due " + task.deadline : ""}` : "A new task has been posted.";
	const data = {
		type: "task",
		taskId: event.params.taskId,
		sectionId: String(task.sectionId || ""),
	};
	await sendNotificationToTokens(title, body, data, tokens);
});

/**
 * Trigger: on new Message created → notify a specific parent or a whole section
 * messages doc expected shape: { fromTeacherId, toParentId?, sectionId?, content, ownerUid, timestamp }
 */
exports.notifyOnMessageCreated = onDocumentCreated("messages/{msgId}", async (event) => {
	const snap = event.data;
	if (!snap) return;
	const message = snap.data();
	if (!message) return;

	let tokens = [];
	if (message.toParentId) {
		tokens = await getTokensForParent(message.toParentId);
	} else if (message.sectionId) {
		tokens = await getTokensForSection(message.sectionId);
	}
	if (!tokens.length) return;

	const title = message.sectionId ? "New announcement" : "New message from teacher";
	const body = String(message.content || "").slice(0, 150);
	const data = {
		type: "message",
		messageId: event.params.msgId,
		sectionId: String(message.sectionId || ""),
		toParentId: String(message.toParentId || ""),
	};
	await sendNotificationToTokens(title, body, data, tokens);
});
