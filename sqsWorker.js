// // backend/sqsWorker.js
// import {
//   SQSClient,
//   ReceiveMessageCommand,
//   DeleteMessageCommand,
//   PurgeQueueCommand, // ✅ correct
// } from "@aws-sdk/client-sqs";

// import dotenv from "dotenv";

// dotenv.config();

// const client = new SQSClient({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY,
//     secretAccessKey: process.env.AWS_SECRET_KEY,
//   },
// });

// const QUEUE_URL = process.env.SQS_URL;

// let latestMessage = null;

// /** Poll once */
// export async function pollSQS() {
//   const res = await client.send(
//     new ReceiveMessageCommand({
//       QueueUrl: QUEUE_URL,
//       MaxNumberOfMessages: 1,
//       WaitTimeSeconds: 10,
//       VisibilityTimeout: 120,
//     }),
//   );

//   if (!res.Messages?.length) {
//     latestMessage = null;
//     return null;
//   }

//   const msg = res.Messages[0];

//   latestMessage = {
//     id: msg.MessageId,
//     body: msg.Body,
//     receipt: msg.ReceiptHandle,
//   };

//   console.log("Received:", latestMessage.id);

//   return latestMessage;
// }

// export function getMessage() {
//   return latestMessage;
// }

// export async function approveMessage(receipt) {
//   if (!receipt) throw new Error("Missing receipt handle");

//   try {
//     await client.send(
//       new DeleteMessageCommand({
//         QueueUrl: QUEUE_URL,
//         ReceiptHandle: receipt,
//       }),
//     );

//     latestMessage = null;
//     console.log("Deleted message");
//   } catch (e) {
//     console.log("Delete failed:", e.message);

//     // ⭐ if receipt expired → repoll
//     if (e.message?.includes("ReceiptHandle")) {
//       console.log("Receipt expired → repolling SQS");
//       await pollSQS();
//     }

//     throw e;
//   }
// }

// // ⭐ delete all messages
// export async function deleteAllMessages() {
//   if (!QUEUE_URL) throw new Error("Missing SQS_URL");

//   await client.send(
//     new PurgeQueueCommand({
//       QueueUrl: QUEUE_URL,
//     }),
//   );

//   latestMessage = null;

//   console.log("Queue purged using SQS_URL");
// }

// import {
//   SQSClient,
//   ReceiveMessageCommand,
//   DeleteMessageCommand,
//   PurgeQueueCommand,
// } from "@aws-sdk/client-sqs";

// import dotenv from "dotenv";
// dotenv.config();

// const client = new SQSClient({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY,
//     secretAccessKey: process.env.AWS_SECRET_KEY,
//   },
// });

// const QUEUE_URL = process.env.SQS_URL;

// let latestMessage = null;

// /** ⭐ SAFE PARSER */
// function parseBody(body) {
//   try {
//     const first = JSON.parse(body);
//     if (typeof first === "string") return JSON.parse(first);
//     return first;
//   } catch {
//     try {
//       const fixed = body.replace(/\n/g, "").replace(/"(\d+),/g, '"$1",');
//       return JSON.parse(fixed);
//     } catch {
//       return null;
//     }
//   }
// }

// /** poll */
// export async function pollSQS() {
//   const res = await client.send(
//     new ReceiveMessageCommand({
//       QueueUrl: QUEUE_URL,
//       MaxNumberOfMessages: 1,
//       WaitTimeSeconds: 10,
//       VisibilityTimeout: 60,
//     }),
//   );

//   if (!res.Messages?.length) {
//     latestMessage = null;
//     return null;
//   }

//   const msg = res.Messages[0];

//   latestMessage = {
//     id: msg.MessageId,
//     body: parseBody(msg.Body), // ⭐ IMPORTANT → object now
//     receipt: msg.ReceiptHandle,
//   };

//   return latestMessage;
// }

// export function getMessage() {
//   return latestMessage;
// }
// export async function approveMessage(receipt) {
//   if (!receipt) return;

//   try {
//     await client.send(
//       new DeleteMessageCommand({
//         QueueUrl: QUEUE_URL,
//         ReceiptHandle: receipt,
//       }),
//     );

//     latestMessage = null;
//   } catch (e) {
//     // ⭐ receipt expired → get fresh message
//     if (e.message?.includes("ReceiptHandle")) {
//       console.log("Receipt expired → repolling");
//       await pollSQS();
//       return;
//     }

//     throw e;
//   }
// }

// export async function deleteAllMessages() {
//   await client.send(
//     new PurgeQueueCommand({
//       QueueUrl: QUEUE_URL,
//     }),
//   );

//   latestMessage = null;
// }

import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  PurgeQueueCommand,
} from "@aws-sdk/client-sqs";

import dotenv from "dotenv";
dotenv.config();

const client = new SQSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

const QUEUE_URL = process.env.SQS_URL;

let latestMessage = null;

/** ⭐ SAFE PARSER */
function parseBody(body) {
  try {
    const first = JSON.parse(body);
    if (typeof first === "string") return JSON.parse(first);
    return first;
  } catch (err1) {
    console.log("❌ First parse failed:", err1.message);

    try {
      const fixed = body.replace(/\n/g, "").replace(/"(\d+),/g, '"$1",');
      return JSON.parse(fixed);
    } catch (err2) {
      console.log("❌ Second parse failed:", err2.message);
      return null;
    }
  }
}

/** 🔁 poll */
export async function pollSQS() {
  console.log("📡 Polling SQS...");

  const res = await client.send(
    new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 10,
      VisibilityTimeout: 60,
    }),
  );

  console.log("📥 Raw SQS response:", JSON.stringify(res, null, 2));

  if (!res.Messages?.length) {
    console.log("⚠ No messages found in queue.");
    latestMessage = null;
    return null;
  }

  const msg = res.Messages[0];

  console.log("📩 Received Message ID:", msg.MessageId);
  console.log("📦 Raw Body:", msg.Body);

  const parsedBody = parseBody(msg.Body);

  console.log("🧠 Parsed Body:", parsedBody);

  if (!parsedBody) {
    console.log("❌ Parsed body is NULL");
  }

  latestMessage = {
    id: msg.MessageId,
    body: parsedBody,
    receipt: msg.ReceiptHandle,
  };

  console.log("✅ Latest message stored:", latestMessage);

  return latestMessage;
}

/** 📤 get message */
export function getMessage() {
  console.log("📦 getMessage called. Current value:", latestMessage);

  if (!latestMessage) {
    console.log("⚠ latestMessage is NULL");
  }

  return latestMessage;
}

/** ✅ approve */
export async function approveMessage(receipt) {
  if (!receipt) {
    console.log("❌ No receipt provided to approveMessage");
    return;
  }

  console.log("🗑 Deleting message with receipt:", receipt);

  try {
    await client.send(
      new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: receipt,
      }),
    );

    console.log("✅ Message deleted successfully.");
    latestMessage = null;
  } catch (e) {
    console.log("❌ Delete error:", e.message);

    if (e.message?.includes("ReceiptHandle")) {
      console.log("⚠ Receipt expired → repolling");
      await pollSQS();
      return;
    }

    throw e;
  }
}

/** 🧹 purge all */
export async function deleteAllMessages() {
  console.log("⚠ Purging entire queue...");

  await client.send(
    new PurgeQueueCommand({
      QueueUrl: QUEUE_URL,
    }),
  );

  latestMessage = null;

  console.log("✅ All messages deleted. latestMessage reset to NULL.");
}
