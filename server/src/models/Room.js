import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    isSharing: { type: Boolean, default: false },
    location: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      timestamp: Number
    }
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true, unique: true, index: true },
    isActive: { type: Boolean, default: true },
    participants: { type: [participantSchema], default: [] }
  },
  { timestamps: true }
);

export const Room = mongoose.model("Room", roomSchema);