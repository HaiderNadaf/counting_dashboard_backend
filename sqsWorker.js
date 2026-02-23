// backend/sqsWorker.js
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  DeleteMessageAllCommand,
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

/** Poll once */
export async function pollSQS() {
  const res = await client.send(
    new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 10,
      VisibilityTimeout: 120,
    }),
  );

  if (!res.Messages?.length) {
    latestMessage = null;
    return null;
  }

  const msg = res.Messages[0];

  latestMessage = {
    id: msg.MessageId,
    body: msg.Body,
    receipt: msg.ReceiptHandle,
  };

  console.log("Received:", latestMessage.id);

  return latestMessage;
}

export function getMessage() {
  return latestMessage;
}

export async function approveMessage(receipt) {
  if (!receipt) throw new Error("Missing receipt handle");

  try {
    await client.send(
      new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: receipt,
      }),
    );

    latestMessage = null;
    console.log("Deleted message");
  } catch (e) {
    console.log("Delete failed:", e.message);

    // ⭐ if receipt expired → repoll
    if (e.message?.includes("ReceiptHandle")) {
      console.log("Receipt expired → repolling SQS");
      await pollSQS();
    }

    throw e;
  }
}

// ⭐ delete all messages
export async function deleteAllMessages() {
  if (!QUEUE_URL) throw new Error("Missing SQS_URL");

  await client.send(
    new DeleteMessageAllCommand({
      QueueUrl: QUEUE_URL, // ⭐ using env SQS_URL
    }),
  );

  latestMessage = null;

  console.log("Queue purged using SQS_URL");
}
