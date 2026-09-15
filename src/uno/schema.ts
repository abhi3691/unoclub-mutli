import { z } from "zod";
export const roomActionSchema = z.object({
  action: z.enum([
    "create",
    "join",
    "quick",
    "sync",
    "ping",
    "skipRanking",
    "start",
    "leave",
    "play",
    "draw",
    "pass",
    "voice",
    "signal",
  ]),
  name: z.string().max(20).optional(),
  code: z
    .string()
    .regex(/^[A-F0-9]{6}$/)
    .optional(),
  token: z.string().length(48).optional(),
  uid: z.string().min(1).max(128).optional(),
  public: z.boolean().optional(),
  scheduledFor: z.number().int().positive().optional(),
  title: z.string().max(40).optional(),
  groupId: z.string().min(1).max(100).optional(),
  card: z.string().max(24).optional(),
  color: z.enum(["red", "yellow", "green", "blue"]).optional(),
  uno: z.boolean().optional(),
  voice: z.boolean().optional(),
  after: z.number().int().nonnegative().optional(),
  to: z.string().max(20).optional(),
  data: z
    .object({
      description: z
        .object({
          type: z.enum(["offer", "answer", "pranswer", "rollback"]),
          sdp: z.string().max(16000).optional(),
        })
        .optional(),
      candidate: z
        .object({
          candidate: z.string().max(2000).optional(),
          sdpMid: z.string().nullable().optional(),
          sdpMLineIndex: z.number().nullable().optional(),
          usernameFragment: z.string().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type RoomAction = z.infer<typeof roomActionSchema>["action"];
