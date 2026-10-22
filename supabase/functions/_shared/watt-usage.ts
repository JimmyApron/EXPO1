declare const Deno: { env: { get(name: string): string | undefined } };

const costs: Record<string, number> = {
  'extract-candidate-ideas': 1, 'extract-candidate-ideas-image': 5,
  'analyze-idea-draft': 1, 'analyze-final-ideas': 1,
  'generate-mvp': 2, 'generate-presentation': 4,
};
const assistantTasks = new Set(['topics','resource','compare','outline','polish','expand','shorten','continue','tone','dialogue','rewrite','feedback','presentation']);
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-watt-request-id, x-watt-consent',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => Response.json({ error, ...extra }, { status, headers: cors });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rpc(url: string, key: string, name: string, args: Record<string, unknown>) {
  return fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args), signal: AbortSignal.timeout(15000),
  });
}

type ProviderCall = { provider: 'deepseek' | 'anthropic'; model: string; attempt: number; input_tokens: number | null; output_tokens: number | null; status: number };
export type WattMeter = { capture: (provider: ProviderCall['provider'], model: string, status: number, result?: unknown) => void };

async function settle(url: string, key: string, usageId: string, response: Response, calls: ProviderCall[]): Promise<boolean> {
  const success = response.ok;
  const body = success ? await response.clone().text() : null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await rpc(url, key, 'watt_settle_usage', {
        p_usage_id: usageId, p_success: success,
        p_error_code: success ? null : `http_${response.status}`,
        p_response_status: success ? response.status : null, p_response_body: body,
        p_provider_calls: calls,
      });
      if (result.ok) {
        const settlement = await result.json() as { state?: string };
        return settlement.state === (success ? 'succeeded' : 'refunded');
      }
    } catch (error) {
      console.error('Watt settlement transport failure', error instanceof Error ? error.name : 'unknown');
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
  }
  return false;
}

/** Reserve before contacting a provider. The database decides scope, quota and cost. */
export async function withWattUsage(request: Request, functionName: string, execute: (meter: WattMeter) => Promise<Response>) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return fail('method_not_allowed', 405);
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return fail('authentication_required', 401);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !serviceKey) return fail('watt_billing_not_configured', 503);
  let input: unknown;
  let raw: string;
  try {
    raw = await request.clone().text();
    const size = new TextEncoder().encode(raw).length;
    if (size > 29_000_000) return fail('input_too_large', 413);
    input = JSON.parse(raw);
  } catch { return fail('invalid_request', 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('invalid_request', 400);
  const body = input as Record<string, unknown>;
  const source = body.source as { type?: unknown } | undefined;
  const image = functionName === 'extract-candidate-ideas' && source?.type === 'image';
  const sizeLimit = image ? 29_000_000 : functionName === 'generate-presentation' ? 600_000
    : functionName === 'workspace-assistant' ? 180_000 : functionName === 'generate-mvp' ? 96_000 : 32_000;
  if (new TextEncoder().encode(raw).length > sizeLimit) return fail('input_too_large', 413);
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: anon }, signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!userResponse?.ok) return fail('authentication_required', 401);
  const user = await userResponse.json().catch(() => null) as { id?: unknown } | null;
  if (!user || typeof user.id !== 'string') return fail('authentication_required', 401);

  const requestId = request.headers.get('x-watt-request-id') ?? body.requestId;
  if (typeof requestId !== 'string' || !uuid.test(requestId)) return fail('invalid_request_id', 400);
  if (typeof body.projectId !== 'string' || !uuid.test(body.projectId)) return fail('invalid_project_id', 400);
  if (body.roomId != null && (typeof body.roomId !== 'string' || !uuid.test(body.roomId))) return fail('invalid_room_id', 400);
  const projectId = body.projectId;
  const roomId = typeof body.roomId === 'string' ? body.roomId : null;
  let feature = functionName;
  if (functionName === 'workspace-assistant') {
    if (typeof body.task !== 'string' || !assistantTasks.has(body.task)) return fail('unsupported_ai_feature', 400);
    feature = `workspace-${body.task}`;
  } else if (functionName === 'extract-candidate-ideas') {
    if (source?.type !== 'image' && source?.type !== 'text') return fail('invalid_source', 400);
    if (source.type === 'image') feature += '-image';
  }
  const units = costs[feature] ?? (feature.startsWith('workspace-')
    ? feature === 'workspace-presentation' ? 4 : ['workspace-compare','workspace-feedback'].includes(feature) ? 2 : 1 : null);
  if (!units) return fail('unsupported_ai_feature', 400);
  // UTF-8 bytes are a conservative upper bound on user-supplied text tokens.
  // Structured generation keeps its separate output budget to avoid truncated JSON.
  if (functionName === 'workspace-assistant' && ['polish','expand','shorten','continue','tone','dialogue','rewrite'].includes(String(body.task))
    && new TextEncoder().encode(raw).length > 6000) return fail('input_too_large', 413);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ functionName, body })));
  const requestHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const reservationResponse = await rpc(url, serviceKey, 'watt_reserve_usage', {
    p_user_id: user.id, p_request_id: requestId, p_feature: feature,
    p_project_id: projectId, p_room_id: roomId, p_units: units,
    p_request_hash: requestHash, p_consent: request.headers.get('x-watt-consent') === String(units),
  }).catch(() => null);
  if (!reservationResponse?.ok) {
    const detail = reservationResponse ? await reservationResponse.text().catch(() => '') : '';
    if (detail.includes('insufficient_units')) return fail('insufficient_units', 402);
    if (detail.includes('rate_limited') || detail.includes('execution_limit')) return fail('rate_limited', 429);
    if (detail.includes('request_id_conflict')) return fail('request_id_conflict', 409);
    if (detail.includes('access_denied') || detail.includes('mismatch')) return fail('project_access_denied', 403);
    console.error('Watt reservation failed', reservationResponse?.status ?? 'network');
    return fail('usage_reservation_failed', 503);
  }
  const reservation = await reservationResponse.json().catch(() => null) as {
    usage_id?: string; state?: string; units?: number; consent_required?: boolean;
    response_status?: number; response_body?: string; usage_kind?: string;
  } | null;
  if (reservation?.consent_required) return fail('consent_required', 409, { units: reservation.units, requestId });
  if (!reservation?.usage_id) return fail('usage_reservation_failed', 503);
  if (reservation.state === 'succeeded' && reservation.response_status && typeof reservation.response_body === 'string') {
    return new Response(reservation.response_body, { status: reservation.response_status, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  if (reservation.state === 'succeeded') return fail('result_unavailable', 409);
  if (reservation.state === 'reserved' && !reservation.usage_kind) return fail('request_in_progress', 409);
  if (reservation.state === 'refunded') return fail('request_already_finished', 409);

  const calls: ProviderCall[] = [];
  const meter: WattMeter = { capture(provider, model, status, result) {
    const usage = result && typeof result === 'object' ? (result as { usage?: { input_tokens?: unknown; output_tokens?: unknown } }).usage : undefined;
    const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
    calls.push({ provider, model: model.slice(0, 100), status, attempt: calls.length + 1,
      input_tokens: count(usage?.input_tokens), output_tokens: count(usage?.output_tokens) });
  } };
  try {
    const response = await execute(meter);
    if (!await settle(url, serviceKey, reservation.usage_id, response, calls)) return fail('usage_settlement_pending', 503);
    return response;
  } catch (error) {
    if (!await settle(url, serviceKey, reservation.usage_id, fail('ai_execution_failed', 502), calls))
      return fail('usage_settlement_pending', 503);
    console.error('Watt execution failed', error instanceof Error ? error.name : 'unknown');
    return fail('ai_execution_failed', 502);
  }
}
