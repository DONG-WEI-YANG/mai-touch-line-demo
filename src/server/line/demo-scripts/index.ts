import { facilityScript } from './facility';
import { repairScript } from './repair';
import { visitorScript } from './visitor';
import { complaintScript } from './complaint';
import type { DemoScript } from './types';

export const SCRIPTS: Record<DemoScript['id'], DemoScript> = {
  facility:  facilityScript,
  repair:    repairScript,
  visitor:   visitorScript,
  complaint: complaintScript,
};

export function listScripts(): DemoScript[] {
  return Object.values(SCRIPTS);
}

export function getScript(id: string): DemoScript | undefined {
  return (SCRIPTS as any)[id];
}
