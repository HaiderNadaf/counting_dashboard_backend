import mongoose from "mongoose";

const approvalSchema = new mongoose.Schema(
  {
    messageId: String,
    truck_number: String,
    original_count: Number,
    approved_count: Number,
    approver: String,
  },
  { timestamps: true },
);

export default mongoose.model("Approval", approvalSchema);
