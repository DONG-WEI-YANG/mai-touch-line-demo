import { residentProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import * as db from "../db";

export const chatRouter = router({
  send: residentProcedure
    .input(z.object({ message: z.string().min(1), language: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await db.createChatMessage({ userId: ctx.user.id, role: "user", content: input.message, language: input.language });

      const history = await db.getUserChatMessages(ctx.user.id, 10);
      const sortedHistory = history.reverse();

      const systemPrompt = input.language === "zh"
        ? `你是 m'AI Touch 的 Digital Brain，一個為頂級住宅社區服務的 AI 智慧管家。你的名字是 Digital Brain。你能協助住戶管理物業服務、預約設施、處理維修請求、安排訪客接待等。請以專業、優雅且溫暖的語氣回應。回覆請簡潔，不超過 3 句話。`
        : `You are the Digital Brain of m'AI Touch, an AI concierge for an elite residential community. You help residents manage property services, book amenities, handle maintenance requests, arrange guest hosting, and more. Respond in a professional, elegant, and warm tone. Keep responses concise, no more than 3 sentences.`;

      const messages = [
        { role: "system" as const, content: [{ type: "text" as const, text: systemPrompt }] },
        ...sortedHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: [{ type: "text" as const, text: m.content }],
        })),
      ];

      const response = await invokeLLM({ messages });
      const choice = response.choices?.[0];
      const msgContent = choice?.message?.content;
      const assistantText = typeof msgContent === "string"
        ? msgContent
        : Array.isArray(msgContent) && msgContent[0]?.type === "text"
          ? (msgContent[0] as { type: "text"; text: string }).text
          : "I'm here to assist you. How may I help?";

      await db.createChatMessage({ userId: ctx.user.id, role: "assistant", content: assistantText, language: input.language });
      return { text: assistantText };
    }),

  history: residentProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const messages = await db.getUserChatMessages(ctx.user.id, input.limit);
      return messages.reverse();
    }),
});
