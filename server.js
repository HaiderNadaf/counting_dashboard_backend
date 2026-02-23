// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";

dotenv.config();

import {
  pollSQS,
  getMessage,
  approveMessage,
  deleteAllMessages,
} from "./sqsWorker.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const APPROVALS_FILE = path.resolve(process.cwd(), "approvals.json");

async function readApprovals() {
  try {
    const raw = await fs.readFile(APPROVALS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveApproval(obj) {
  const arr = await readApprovals();
  arr.push(obj);
  await fs.writeFile(APPROVALS_FILE, JSON.stringify(arr, null, 2));
}

/** cached message */
app.get("/message", (req, res) => {
  res.json(getMessage());
});

/** fetch next */
app.post("/fetch", async (req, res) => {
  try {
    const existing = getMessage();
    if (existing) return res.json(existing);

    const msg = await pollSQS();
    res.json(msg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** approve */
app.post("/approve", async (req, res) => {
  try {
    const { approver, message } = req.body;

    if (!message?.receipt) {
      return res.status(400).json({ error: "No message provided" });
    }

    await approveMessage(message.receipt);

    const record = {
      messageId: message.id,
      body: message.body,
      approver: approver || "unknown",
      approvedAt: new Date().toISOString(),
    };

    await saveApproval(record);

    const next = await pollSQS();

    res.json({
      ok: true,
      approved: record,
      next,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** approvals list */
app.get("/approvals", async (req, res) => {
  res.json(await readApprovals());
});

/** delete all messages */
app.post("/deleteAll", async (req, res) => {
  try {
    const count = await deleteAllMessages();

    res.json({
      ok: true,
      deleted: count,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log("Server running", PORT));
