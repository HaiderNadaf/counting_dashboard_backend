import mongoose from "mongoose";

const todayTotalSchema = new mongoose.Schema(
  {
    truck_number: String,
    totalApproved: Number,
    entries: Number,
    date: Date,
  },
  { timestamps: true },
);

export default mongoose.model("TodayTotal", todayTotalSchema);
