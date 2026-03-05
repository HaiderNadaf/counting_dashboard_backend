import {
  SQSClient,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
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

async function diagnoseQueue() {
  console.log("🔍 Diagnosing SQS Queue...\n");
  console.log("Queue URL:", QUEUE_URL);
  console.log("─".repeat(60));

  try {
    // Get queue attributes
    const attrs = await client.send(
      new GetQueueAttributesCommand({
        QueueUrl: QUEUE_URL,
        AttributeNames: ["All"],
      }),
    );

    console.log("\n📊 Queue Statistics:");
    console.log("─".repeat(60));
    console.log(
      "Available Messages:",
      attrs.Attributes.ApproximateNumberOfMessages,
    );
    console.log(
      "In-Flight Messages:",
      attrs.Attributes.ApproximateNumberOfMessagesNotVisible,
    );
    console.log(
      "Delayed Messages:",
      attrs.Attributes.ApproximateNumberOfMessagesDelayed,
    );
    console.log("\nQueue Settings:");
    console.log(
      "Default Visibility Timeout:",
      attrs.Attributes.VisibilityTimeout,
      "seconds",
    );
    console.log(
      "Message Retention:",
      attrs.Attributes.MessageRetentionPeriod,
      "seconds",
    );
    console.log(
      "Receive Wait Time:",
      attrs.Attributes.ReceiveMessageWaitTimeSeconds,
      "seconds",
    );

    const available = parseInt(attrs.Attributes.ApproximateNumberOfMessages);
    const inFlight = parseInt(
      attrs.Attributes.ApproximateNumberOfMessagesNotVisible,
    );
    const total = available + inFlight;

    console.log("\n─".repeat(60));
    console.log(`📦 Total Messages: ${total}`);
    console.log(`   ✅ Available: ${available}`);
    console.log(`   ⏳ In-Flight (Invisible): ${inFlight}`);
    console.log("─".repeat(60));

    if (inFlight > 0 && available === 0) {
      console.log("\n⚠️  ISSUE DETECTED:");
      console.log("All messages are currently IN-FLIGHT (invisible).");
      console.log("\nThis happens when:");
      console.log("• Messages were fetched but not deleted");
      console.log("• Visibility timeout hasn't expired yet");
      console.log("\n💡 Solutions:");
      console.log("1. Wait for visibility timeout to expire");
      console.log(`   (Queue default: ${attrs.Attributes.VisibilityTimeout}s)`);
      console.log("2. OR purge the queue and re-send messages");
      console.log("3. OR use the purge endpoint: POST /deleteAll");
    }

    // Try to receive a message with short wait
    console.log("\n\n🔄 Attempting to receive message (5s wait)...");
    const receiveResult = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 5,
        VisibilityTimeout: 30,
      }),
    );

    if (receiveResult.Messages?.length) {
      console.log("✅ Successfully received a message!");
      console.log("Message ID:", receiveResult.Messages[0].MessageId);
      console.log(
        "Body preview:",
        receiveResult.Messages[0].Body.substring(0, 100) + "...",
      );
    } else {
      console.log("❌ No messages received");
      if (available > 0) {
        console.log("\n⚠️  Queue shows available messages but none received.");
        console.log("This could mean:");
        console.log("• Messages might be delayed");
        console.log("• Queue permissions issue");
      }
    }
  } catch (error) {
    console.error("\n❌ Error diagnosing queue:");
    console.error(error.message);

    if (error.name === "AccessDeniedException") {
      console.log("\n⚠️  Permission issue detected!");
      console.log("Check that your AWS credentials have these permissions:");
      console.log("• sqs:GetQueueAttributes");
      console.log("• sqs:ReceiveMessage");
    }
  }

  console.log("\n" + "─".repeat(60));
}

diagnoseQueue();
