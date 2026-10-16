type DenoEnv = { get(name: string): string | undefined };
declare const Deno: { env: DenoEnv };

const costs: Record<string, number> = {
  'extract-candidate-ideas': 1,
  'analyze-idea-draft': 1,
  'analyze-final-ideas': 1,
  'generate-mvp': 2,
  'generate-presentation': 4,
};

function assistantCost(body: Record<string, unknown>) {
  const task = body.task;
  if (task === 'presentation') return 4;
  if (task === 'compare' || task === 'feedback') return 2;
  return 1;
}

function fail(error: string, status: number) {
  return Response.json({ error }, { status, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-watt-request-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  } });
}

async function settle(url: string, serviceKey: string, usageId: string, success: boolean, reason?: string) {
  try {
    await fetch(`${url}/rest/v1/rpc/watt_settle_usage`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_usage_id: usageId, p_success: success, p_error_code: reason ?? null }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    console.error('Watt usage settlement request failed.', error instanceof Error ? error.name : 'unknown');
  }
}

/** Verifies identity and reserves a server-defined cost before any AI provider call. */
export async function withWattUsage(request: Request, functionName: string, execute: () => Promise<Response>) {
  if (request.method === 'OPTIONS') return execute();
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return fail('authentication_required', 401);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !serviceKey) return fail('watt_billing_not_configured', 503);

  let input: unknown;
  try { input = await request.clone().json(); } catch { return fail('invalid_request', 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('invalid_request', 400);
  const body = input as Record<string, unknown>;
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: authorization, apikey: anon }, signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!userResponse?.ok) return fail('authentication_required', 401);
  const user = await userResponse.json().catch(() => null) as { id?: unknown } | null;
  if (!user || typeof user.id !== 'string') return fail('authentication_required', 401);

  const requestId = request.headers.get('x-watt-request-id') ?? (typeof body.requestId === 'string' ? body.requestId : crypto.randomUUID());
  if (!/^[a-f\d-]{36}$/i.test(requestId)) return fail('invalid_request_id', 400);
  const projectId = typeof body.projectId === 'string' && /^[a-f\d-]{36}$/i.test(body.projectId) ? body.projectId : null;
  const roomId = typeof body.roomId === 'string' && /^[a-f\d-]{36}$/i.test(body.roomId) ? body.roomId : null;
  const feature = functionName === 'workspace-assistant' && typeof body.task === 'string' ? `workspace-${body.task}` : functionName;
  const units = functionName === 'workspace-assistant' ? assistantCost(body) : costs[functionName];
  if (!units) return fail('unsupported_ai_feature', 400);
  const chargeUnits = functionName === 'extract-candidate-ideas' && (body.source as {type?:unknown}|undefined)?.type === 'image' ? 5 : units;
  const reservationResponse = await fetch(`${url}/rest/v1/rpc/watt_reserve_usage`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user_id: user.id, p_request_id: requestId, p_feature: feature, p_project_id: projectId, p_room_id: roomId, p_units: chargeUnits }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!reservationResponse?.ok) {
    const detail = reservationResponse ? await reservationResponse.text().catch(() => '') : '';
    if (detail.includes('insufficient_units')) return fail('insufficient_units', 402);
    if (detail.includes('rate_limited')) return fail('rate_limited', 429);
    if (detail.includes('duplicate_request') || detail.includes('unique constraint')) return fail('duplicate_request', 409);
    if (detail.includes('access_denied')) return fail('project_access_denied', 403);
    console.error('Watt usage reservation failed.', reservationResponse?.status ?? 'network');
    return fail('usage_reservation_failed', reservationResponse?.status === 400 ? 403 : 503);
  }
  const reservation = await reservationResponse.json().catch(() => null) as { usage_id?: unknown } | null;
  if (!reservation || typeof reservation.usage_id !== 'string') return fail('usage_reservation_failed', 503);

  try {
    const response = await execute();
    await settle(url, serviceKey, reservation.usage_id, response.ok, response.ok ? undefined : `http_${response.status}`);
    if (!response.ok) return response;
    return response;
  } catch (error) {
    await settle(url, serviceKey, reservation.usage_id, false, error instanceof Error ? error.name : 'unknown');
    throw error;
  }
}
