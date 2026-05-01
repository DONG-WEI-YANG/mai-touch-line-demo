/**
 * System router for health checks and system information
 */
import { router, publicProcedure } from "./trpc";
import { ENV } from "./env";

export const systemRouter = router({
  health: publicProcedure.query(() => {
    return {
      status: "ok",
      timestamp: Date.now(),
      environment: ENV.nodeEnv,
      services: {
        database: !!ENV.databaseUrl,
        nlp: ENV.nlpServiceEnabled,
        openai: !!ENV.openaiApiKey,
      },
    };
  }),

  info: publicProcedure.query(() => {
    return {
      name: "m'AI Touch API",
      version: "1.0.0",
      environment: ENV.nodeEnv,
    };
  }),
});
