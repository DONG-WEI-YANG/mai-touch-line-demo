import { getScript } from '../demo-scripts';
import type { DemoStep } from '../demo-scripts/types';
import type { SessionStore, SessionState } from '../session-store';
import type { LineClient } from '../line-client';
import type { Lang } from '../ai/types';
import { t } from '../flex/i18n';

export type DemoDeps = {
  store: SessionStore;
  client: LineClient;
  lineUser: { lineUserId: string; language: Lang };
  runSideEffect: (call: { router: string; procedure: string; input: unknown }) => Promise<void>;
  // Optional callback to honor the demo_script_config.enabled flag set in dashboard
  // (Phase 9 admin dashboard). If absent, all scripts are considered enabled.
  isScriptEnabled?: (id: string) => boolean;
};

export async function startDemo(scriptId: string, deps: DemoDeps): Promise<void> {
  const script = getScript(scriptId);
  if (!script) {
    await deps.client.push(deps.lineUser.lineUserId,
      { type: 'text', text: `unknown script: ${scriptId}` });
    return;
  }
  if (deps.isScriptEnabled && !deps.isScriptEnabled(scriptId)) {
    await deps.client.push(deps.lineUser.lineUserId,
      { type: 'text', text: `script "${scriptId}" is currently disabled by admin` });
    return;
  }
  const userId = deps.lineUser.lineUserId;
  // Initialize session state for the demo
  const state: SessionState = deps.store.get(userId) ?? {
    userId, role: 'resident', step: 'IDLE', slots: {}, missingSlots: [],
    language: deps.lineUser.language, updatedAt: Date.now(),
  };
  deps.store.set(userId, { ...state, demoScriptId: scriptId, demoStep: 0 });
  await runFromCurrentStep(deps, script.steps);
}

export async function continueDemo(ev: any, deps: DemoDeps): Promise<void> {
  const session = deps.store.get(deps.lineUser.lineUserId);
  if (!session?.demoScriptId) return;
  const script = getScript(session.demoScriptId);
  if (!script) return;

  const cur = script.steps[session.demoStep ?? 0];
  if (cur?.kind !== 'wait_user') return;  // not currently awaiting user input
  if (cur.expect === 'postback' && ev.type !== 'postback') return;
  if (cur.postbackData && ev.postback?.data !== cur.postbackData) return;

  // Advance past the wait_user step
  deps.store.set(deps.lineUser.lineUserId, {
    ...session,
    demoStep: (session.demoStep ?? 0) + 1,
  });
  await runFromCurrentStep(deps, script.steps);
}

export async function stopDemo(deps: DemoDeps): Promise<void> {
  const userId = deps.lineUser.lineUserId;
  const session = deps.store.get(userId);
  if (session) {
    deps.store.set(userId, { ...session, demoScriptId: undefined, demoStep: undefined });
  }
  await deps.client.push(userId,
    { type: 'text', text: t('msg.demoEnded', deps.lineUser.language) });
}

async function runFromCurrentStep(deps: DemoDeps, steps: DemoStep[]): Promise<void> {
  // Loop guard: prevent runaway scripts from infinite-looping (corrupt state)
  let safety = steps.length + 1;
  while (safety-- > 0) {
    const s = deps.store.get(deps.lineUser.lineUserId);
    if (!s || s.demoScriptId === undefined) return;
    const idx = s.demoStep ?? 0;
    const step = steps[idx];
    if (!step) {
      // End of script — clear demo state
      deps.store.set(deps.lineUser.lineUserId, {
        ...s, demoScriptId: undefined, demoStep: undefined,
      });
      return;
    }
    if (step.kind === 'wait_user') return;  // suspend; resume on next user event

    try {
      if (step.kind === 'bot_say') {
        await deps.client.push(deps.lineUser.lineUserId, step.message);
        if (step.delayMs) await sleep(step.delayMs);
      } else if (step.kind === 'simulate_housekeeper') {
        await sleep(step.delayMs);
        await deps.client.push(deps.lineUser.lineUserId, { type: 'text', text: step.message });
      } else if (step.kind === 'side_effect') {
        await deps.runSideEffect(step.trpcCall);
      }
    } catch (err) {
      console.error('[LINE] demo step failed', { idx, kind: step.kind, err });
      // Clear demo state on failure to avoid stuck sessions
      const cur = deps.store.get(deps.lineUser.lineUserId);
      if (cur) deps.store.set(deps.lineUser.lineUserId,
        { ...cur, demoScriptId: undefined, demoStep: undefined });
      await deps.client.push(deps.lineUser.lineUserId,
        { type: 'text', text: t('msg.demoEnded', deps.lineUser.language) });
      return;
    }

    deps.store.set(deps.lineUser.lineUserId, { ...s, demoStep: idx + 1 });
  }
  console.warn('[LINE] demo runFromCurrentStep safety break — possible corrupt state');
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
