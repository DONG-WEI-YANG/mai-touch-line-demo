/**
 * tRPC Context
 * Provides request context including user authentication
 */
import type { Request, Response } from "express";
import type { User } from "../schema";
import type { LineClient } from '../line/line-client';
import type { makeRuntimeConfig } from '../line/runtime-config';
import type { makeLineUserRepo } from '../line/line-user-repo';
import type { makeMessageLog } from '../line/message-log';
import type Database from 'better-sqlite3';
import { userFromToken } from './token-auth';

export type LineAdminContext = {
  db: Database.Database;
  runtimeConfig: ReturnType<typeof makeRuntimeConfig>;
  lineUserRepo: ReturnType<typeof makeLineUserRepo>;
  messageLog: ReturnType<typeof makeMessageLog>;
  lineClient: LineClient;
  channelId: string;
};

let lineAdminCtx: LineAdminContext | null = null;

export function setLineAdminContext(ctx: LineAdminContext | null): void {
  lineAdminCtx = ctx;
}

export function getLineAdminContext(): LineAdminContext | null {
  return lineAdminCtx;
}

export type TrpcContext = {
  req: Request;
  res: Response;
  user: User | null;
  lineAdmin?: LineAdminContext;
};

/**
 * Create context for tRPC procedures
 * This is called for every request
 */
export async function createContext({ req, res }: { req: Request; res: Response }): Promise<TrpcContext> {
  // Check Authorization: Bearer <token> header first (web/Vercel token auth)
  const authHeader = String(req.headers['authorization'] ?? '');
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    const synth = userFromToken(token);
    if (synth) {
      return {
        user: synth as any,  // SyntheticUser is structurally compatible with User
        req,
        res,
        lineAdmin: getLineAdminContext() ?? undefined,
      };
    }
  }

  // User will be attached by auth middleware if authenticated
  const user = (req as any).user || null;

  return {
    req,
    res,
    user,
    lineAdmin: getLineAdminContext() ?? undefined,
  };
}
