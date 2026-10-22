declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Response | Promise<Response>): void };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rpc<T>(url: string, key: string, name: string, args: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(details.slice(0, 300) || `billing_${response.status}`);
  }
  return await response.json() as T;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'unauthenticated' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'billing_server_not_configured' }, 503);

  let userId = '';
  try {
    const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: authorization, apikey: anonKey }, signal: AbortSignal.timeout(10000) });
    const user: unknown = await userResponse.json();
    if (!userResponse.ok || !isRecord(user) || typeof user.id !== 'string') return json({ error: 'unauthenticated' }, 401);
    userId = user.id;
  } catch { return json({ error: 'auth_unavailable' }, 503); }

  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.action !== 'string') return json({ error: 'invalid_request' }, 400);
    if (body.roomId != null && (typeof body.roomId !== 'string' || !uuid.test(body.roomId))) return json({ error: 'invalid_room_id' }, 400);
    if (body.projectId != null && (typeof body.projectId !== 'string' || !uuid.test(body.projectId))) return json({ error: 'invalid_project_id' }, 400);
    if (['activate','trial','topup','resume'].includes(body.action) && Deno.env.get('WATT_DEMO_BILLING_ENABLED') === 'false')
      return json({ error: 'simulated_billing_disabled' }, 403);
    const roomId = typeof body.roomId === 'string' ? body.roomId : null;
    let data: unknown;
    switch (body.action) {
      case 'state': {
        let resolvedRoomId = roomId;
        if (typeof body.projectId === 'string') {
          const projectResponse = await fetch(`${url}/rest/v1/projects?select=userid,roomid&id=eq.${encodeURIComponent(body.projectId)}&limit=1`, {
            headers: { apikey: anonKey, Authorization: authorization }, signal: AbortSignal.timeout(10000),
          });
          const projects: unknown = projectResponse.ok ? await projectResponse.json() : [];
          const project = Array.isArray(projects) ? projects[0] as {userid?:string;roomid?:string|null}|undefined : undefined;
          if (!project || (project.userid !== userId && !project.roomid)) return json({ error: 'project_access_denied' }, 403);
          resolvedRoomId = project.roomid ?? null;
          if (project.userid !== userId && resolvedRoomId) {
            const member = await fetch(`${url}/rest/v1/roommembers?select=id&roomid=eq.${encodeURIComponent(resolvedRoomId)}&userid=eq.${encodeURIComponent(userId)}&limit=1`, {
              headers: { apikey: anonKey, Authorization: authorization }, signal: AbortSignal.timeout(10000),
            });
            const members: unknown = member.ok ? await member.json() : [];
            if (!Array.isArray(members) || !members.length) return json({ error: 'project_access_denied' }, 403);
          }
        }
        const personal = await rpc(url, serviceKey, 'watt_balance', { p_user_id: userId, p_room_id: null });
        let team = null;
        if (resolvedRoomId) {
          const membership = await fetch(`${url}/rest/v1/roommembers?select=id&roomid=eq.${encodeURIComponent(resolvedRoomId)}&userid=eq.${encodeURIComponent(userId)}&limit=1`, {
            headers: { apikey: anonKey, Authorization: authorization }, signal: AbortSignal.timeout(10000),
          });
          const members: unknown = membership.ok ? await membership.json() : [];
          if (!Array.isArray(members) || members.length === 0) return json({ error: 'room_access_denied' }, 403);
          team = await rpc(url, serviceKey, 'watt_balance', { p_user_id: userId, p_room_id: resolvedRoomId });
        }
        const trialCheck = await fetch(`${url}/rest/v1/watt_trials?select=id&user_id=eq.${encodeURIComponent(userId)}&limit=1`, {
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(10000),
        });
        data = { personal, team, trialUsed: trialCheck.ok && (await trialCheck.json()).length > 0 };
        break;
      }
      case 'activate':
        if (!['personal_30','personal_120','team_30','team_120'].includes(String(body.productId))) return json({ error: 'invalid_product' }, 400);
        data = await rpc(url, serviceKey, 'watt_activate', { p_user_id: userId, p_product_id: body.productId, p_room_id: roomId, p_student: false });
        break;
      case 'trial':
        if (body.scope !== 'personal' && body.scope !== 'team') return json({ error: 'invalid_scope' }, 400);
        data = await rpc(url, serviceKey, 'watt_start_trial', { p_user_id: userId, p_scope: body.scope, p_room_id: roomId });
        break;
      case 'cancel':
        if (typeof body.entitlementId !== 'string') return json({ error: 'invalid_entitlement' }, 400);
        data = await rpc(url, serviceKey, 'watt_cancel', { p_user_id: userId, p_entitlement_id: body.entitlementId });
        break;
      case 'resume':
        if (typeof body.entitlementId !== 'string') return json({ error: 'invalid_entitlement' }, 400);
        data = await rpc(url, serviceKey, 'watt_resume', { p_user_id: userId, p_entitlement_id: body.entitlementId });
        break;
      case 'preview':
        if (!['personal_30','personal_120','team_30','team_120'].includes(String(body.productId))) return json({ error: 'invalid_product' }, 400);
        data = await rpc(url, serviceKey, 'watt_preview', { p_user_id: userId, p_product_id: body.productId, p_room_id: roomId });
        break;
      case 'topup':
        if (body.productId !== 'topup_s' && body.productId !== 'topup_m') return json({ error: 'invalid_product' }, 400);
        data = await rpc(url, serviceKey, 'watt_add_topup', {
          p_user_id: userId,
          p_product_id: body.productId,
          p_room_id: roomId,
          p_request_id: typeof body.requestId === 'string' && /^[a-f\d-]{36}$/i.test(body.requestId) ? body.requestId : crypto.randomUUID(),
        });
        break;
      case 'products': {
        const response = await fetch(`${url}/rest/v1/watt_products?select=id,scope,label,price_krw,student_price_krw,duration_days,included_units,cycle_days&active=eq.true&order=price_krw.asc`, {
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error('products_unavailable');
        data = (await response.json() as { id?: string }[]).filter(product => product.id !== 'trial_personal' && product.id !== 'trial_team');
        break;
      }
      case 'history': {
        const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
        let teamUsage: unknown[] = [];
        if (roomId) {
          const membership = await fetch(`${url}/rest/v1/roommembers?select=id&roomid=eq.${encodeURIComponent(roomId)}&userid=eq.${encodeURIComponent(userId)}&limit=1`, {
            headers: { apikey: anonKey, Authorization: authorization }, signal: AbortSignal.timeout(10000),
          });
          const members: unknown = membership.ok ? await membership.json() : [];
          if (!Array.isArray(members) || members.length === 0) return json({ error: 'room_access_denied' }, 403);
          const roomUsageResponse = await fetch(`${url}/rest/v1/watt_usage?select=id,project_id,room_id,feature,units,state,error_code,created_at,completed_at&room_id=eq.${encodeURIComponent(roomId)}&order=created_at.desc&limit=100`, { headers, signal: AbortSignal.timeout(10000) });
          if (!roomUsageResponse.ok) throw new Error('history_unavailable');
          teamUsage = await roomUsageResponse.json();
        }
        const [purchases, usage] = await Promise.all([
          fetch(`${url}/rest/v1/watt_purchases?select=*,watt_products(label)&user_id=eq.${userId}&order=created_at.desc&limit=100`, { headers }),
          fetch(`${url}/rest/v1/watt_usage?select=id,project_id,room_id,feature,units,state,error_code,created_at,completed_at&user_id=eq.${userId}&order=created_at.desc&limit=100`, { headers }),
        ]);
        if (!purchases.ok || !usage.ok) throw new Error('history_unavailable');
        data = { purchases: await purchases.json(), usage: await usage.json(), teamUsage };
        break;
      }
      default: return json({ error: 'unsupported_action' }, 400);
    }
    return json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'billing_failed';
    const known: Record<string,{status:number;message:string}> = {
      invalid_product:{status:400,message:'선택한 상품을 찾을 수 없습니다.'},
      invalid_scope:{status:400,message:'이용 대상과 상품 유형을 확인해 주세요.'},
      room_owner_required:{status:403,message:'팀 이용권은 방장만 관리할 수 있습니다.'},
      room_access_denied:{status:403,message:'이 팀 방을 조회할 권한이 없습니다.'},
      project_access_denied:{status:403,message:'이 과제에 접근할 권한이 없습니다.'},
      room_member_limit:{status:409,message:'팀 이용권은 최대 5명까지 사용할 수 있습니다.'},
      team_limit:{status:409,message:'팀 이용권은 최대 5명까지 사용할 수 있습니다.'},
      active_entitlement_exists:{status:409,message:'이미 이용 중인 이용권이 있습니다.'},
      trial_not_cancellable:{status:409,message:'무료체험은 해지 예약할 수 없습니다.'},
      trial_already_used:{status:409,message:'무료체험은 계정당 한 번만 이용할 수 있습니다.'},
      entitlement_expired:{status:409,message:'이용 기간이 종료된 이용권입니다.'},
      entitlement_not_found:{status:404,message:'이용권을 찾을 수 없습니다.'},
      duplicate_request:{status:409,message:'이미 처리한 요청입니다.'},
      forbidden:{status:403,message:'이 작업을 수행할 권한이 없습니다.'},
    };
    const matched = Object.entries(known).find(([key])=>message.includes(key))?.[1];
    if(message.includes('insufficient_units')) return json({error:'insufficient_units',message:'AI 사용량이 부족합니다.'},402);
    return matched ? json({error:'billing_operation_failed',message:matched.message},matched.status)
      : json({error:'billing_operation_failed',message:'요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'},500);
  }
});
