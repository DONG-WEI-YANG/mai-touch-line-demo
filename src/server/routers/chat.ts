import { residentProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import * as db from "../db";
import { sendResidentChat } from "../services/chatService";

export const chatRouter = router({
  send: residentProcedure
    .input(z.object({ message: z.string().trim().min(1), language: z.string().optional() }))
    .mutation(({ ctx, input }) => sendResidentChat(
      { userId: ctx.user.id, message: input.message, language: input.language },
      {
        createMessage: (message) => db.createChatMessage(message),
        getMessages: (userId, limit) => db.getUserChatMessages(userId, limit),
        invoke: invokeLLM,
      },
    )),

  history: residentProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      // Used by the typed client query key to isolate caches across token/user
      // switches. Authorization always comes from ctx.user, never this value.
      viewerKey: z.string().max(64).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const messages = await db.getUserChatMessages(ctx.user.id, input.limit);
      return messages.reverse();
    }),
});
