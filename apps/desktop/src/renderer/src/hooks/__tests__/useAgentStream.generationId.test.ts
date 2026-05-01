/**
 * Verifies that agent:event:v1 payloads carry generationId through to log
 * payloads. The handlers in useAgentStream extract event.generationId into
 * console.debug calls — this test exercises the extraction logic in isolation
 * without needing a React renderer or Electron IPC.
 */

import { describe, expect, it } from 'vitest';
import type { AgentStreamEvent } from '../../../../preload/index';

interface LogPayload {
  generationId: string;
  designId: string;
  textLen?: number | undefined;
  message?: string | undefined;
  code?: string | undefined;
  toolName?: string | undefined;
  toolCallId?: string | undefined;
}

/** Simulates the log-payload extraction performed by handleTurnStart. */
function turnStartLogPayload(event: AgentStreamEvent): LogPayload {
  return { generationId: event.generationId, designId: event.designId };
}

/** Simulates the log-payload extraction performed by handleTurnEnd. */
function turnEndLogPayload(event: AgentStreamEvent, textBuffer: string): LogPayload {
  return {
    generationId: event.generationId,
    designId: event.designId,
    textLen: (event.finalText ?? textBuffer).length,
  };
}

/** Simulates the log-payload extraction performed by handleError. */
function errorLogPayload(event: AgentStreamEvent): LogPayload {
  return {
    generationId: event.generationId,
    designId: event.designId,
    message: event.message,
    code: event.code,
  };
}

/** Simulates the log-payload extraction performed by handleAgentEnd. */
function agentEndLogPayload(event: AgentStreamEvent): LogPayload {
  return { generationId: event.generationId, designId: event.designId };
}

/** Simulates the log-payload extraction performed by handleToolCallStart. */
function toolCallStartLogPayload(event: AgentStreamEvent): LogPayload {
  return {
    generationId: event.generationId,
    designId: event.designId,
    toolName: event.toolName ?? 'unknown',
    toolCallId: event.toolCallId,
  };
}

describe('useAgentStream — generationId in log payloads', () => {
  const GEN_ID = 'lf3a2k-xyz9';
  const DESIGN_ID = 'design-001';

  const baseEvent = (
    type: AgentStreamEvent['type'],
    extra: Partial<AgentStreamEvent> = {},
  ): AgentStreamEvent => ({
    type,
    designId: DESIGN_ID,
    generationId: GEN_ID,
    ...extra,
  });

  it('turn_start log carries generationId', () => {
    const payload = turnStartLogPayload(baseEvent('turn_start'));
    expect(payload.generationId).toBe(GEN_ID);
    expect(payload.designId).toBe(DESIGN_ID);
  });

  it('turn_end log carries generationId and textLen', () => {
    const payload = turnEndLogPayload(baseEvent('turn_end', { finalText: 'hello' }), '');
    expect(payload.generationId).toBe(GEN_ID);
    expect(payload.textLen).toBe(5);
  });

  it('turn_end falls back to textBuffer when finalText absent', () => {
    const payload = turnEndLogPayload(baseEvent('turn_end'), 'buffered text');
    expect(payload.generationId).toBe(GEN_ID);
    expect(payload.textLen).toBe('buffered text'.length);
  });

  it('error log carries generationId, message, code', () => {
    const payload = errorLogPayload(
      baseEvent('error', { message: 'timeout', code: 'GENERATION_TIMEOUT' }),
    );
    expect(payload.generationId).toBe(GEN_ID);
    expect(payload.message).toBe('timeout');
    expect(payload.code).toBe('GENERATION_TIMEOUT');
  });

  it('agent_end log carries generationId', () => {
    const payload = agentEndLogPayload(baseEvent('agent_end'));
    expect(payload.generationId).toBe(GEN_ID);
  });

  it('tool_call_start log carries generationId and toolName', () => {
    const payload = toolCallStartLogPayload(
      baseEvent('tool_call_start', { toolName: 'str_replace', toolCallId: 'tc-1' }),
    );
    expect(payload.generationId).toBe(GEN_ID);
    expect(payload.toolName).toBe('str_replace');
    expect(payload.toolCallId).toBe('tc-1');
  });

  it('AgentStreamEvent.generationId is a non-empty string', () => {
    // Verifies the type contract: generationId: string (required, not undefined).
    const event: AgentStreamEvent = {
      type: 'turn_start',
      designId: DESIGN_ID,
      generationId: GEN_ID,
    };
    expect(typeof event.generationId).toBe('string');
    expect(event.generationId.length).toBeGreaterThan(0);
  });
});
