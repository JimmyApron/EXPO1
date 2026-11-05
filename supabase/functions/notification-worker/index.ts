// Called by a trusted Cron job. Inbox records remain available when push is disabled.
declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};
type Notification = {
  id: string;
  recipientid: string;
  projectid: string | null;
  kind: string;
  scope: 'personal' | 'team';
  title: string;
  message: string;
  target: string;
  pushattempts: number;
  pushstatus?: string;
};
type Device = { token: string };
type Attempt = { id: string; ticketid: string; token: string };
type ExpoTicket = { status: 'ok' | 'error'; id?: string; details?: { error?: string }; message?: string };

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const workerSecret = Deno.env.get('NOTIFICATION_WORKER_SECRET') ?? '';
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? '';
const apiHeaders = {
  Authorization: `Bearer ${serviceKey}`,
  apikey: serviceKey,
  'Content-Type': 'application/json',
};

async function db<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...apiHeaders, ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Database request failed (${response.status}): ${await response.text()}`);
  const body = await response.text();
  return (body ? JSON.parse(body) : null) as T;
}

async function patchNotification(id: string, patch: Record<string, unknown>) {
  await db(`app_notifications?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(patch),
  });
}

async function retry(notification: Notification) {
  if (notification.pushattempts >= 4) {
    await patchNotification(notification.id, { pushstatus: 'failed' });
    return;
  }
  const minutes = Math.min(60, 2 ** notification.pushattempts);
  await patchNotification(notification.id, {
    pushstatus: 'pending', pushafter: new Date(Date.now() + minutes * 60_000).toISOString(),
  });
}

async function send(notification: Notification): Promise<string> {
  const fresh = await db<Notification[]>(`app_notifications?id=eq.${notification.id}&select=id,pushstatus`);
  if (fresh[0]?.pushstatus !== 'processing') return 'skipped';
  const actionable = await db<boolean>('rpc/notification_is_actionable', {
    method: 'POST', body: JSON.stringify({ p_id: notification.id }),
  });
  if (!actionable) {
    await patchNotification(notification.id, { pushstatus: 'skipped' });
    return 'resolved';
  }
  const devices = await db<Device[]>(
    `notification_devices?userid=eq.${encodeURIComponent(notification.recipientid)}&select=token`,
  );
  if (devices.length === 0) {
    await patchNotification(notification.id, { pushstatus: 'skipped' });
    return 'no_device';
  }

  // A single project should not generate a stream of routine push alerts.
  const routine = ['ideareview', 'finalselection', 'stalledidea', 'feedback', 'likesurge'];
  if (routine.includes(notification.kind)) {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const daily = await db<{ id: string; projectid: string | null }[]>(
      `app_notifications?recipientid=eq.${notification.recipientid}` +
      `&kind=in.(ideareview,finalselection,stalledidea,feedback,likesurge)` +
      `&pushstatus=eq.sent&createdat=gte.${encodeURIComponent(since)}&select=id,projectid&limit=4`,
    );
    if (daily.length >= 3 || (notification.projectid && daily.some((item) => item.projectid === notification.projectid))) {
      await patchNotification(notification.id, { pushstatus: 'skipped' });
      return 'daily_cap';
    }
  }

  let body = notification.message;
  if (notification.kind === 'feedback' || notification.kind === 'team_feedback') {
    const kind = encodeURIComponent(notification.kind);
    const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
    const grouped = await db<{ id: string }[]>(
      `app_notifications?recipientid=eq.${notification.recipientid}&projectid=eq.${notification.projectid}` +
      `&kind=eq.${kind}&createdat=gte.${encodeURIComponent(cutoff)}` +
      `&pushstatus=in.(pending,processing)&select=id&limit=100`,
    );
    if (grouped.length > 1) body = `내 아이디어에 새 피드백 ${grouped.length}개가 달렸어요.`;
    for (const item of grouped) {
      if (item.id !== notification.id) await patchNotification(item.id, { pushstatus: 'skipped' });
    }
  }

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
    },
    body: JSON.stringify(devices.map(({ token }) => ({
      to: token,
      title: notification.title,
      body,
      data: { notificationId: notification.id, target: notification.target },
      channelId: notification.scope,
      sound: 'default',
    }))),
  });
  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) {
      await retry(notification);
      return 'retry';
    }
    await patchNotification(notification.id, { pushstatus: 'failed' });
    return 'failed';
  }
  const result = await response.json() as { data?: ExpoTicket[] };
  const tickets = result.data ?? [];
  if (tickets.length !== devices.length) {
    await retry(notification);
    return 'retry';
  }
  let accepted = 0;
  for (let index = 0; index < tickets.length; index++) {
    const ticket = tickets[index];
    const token = devices[index].token;
    if (ticket.status === 'ok' && ticket.id) accepted++;
    if (ticket.details?.error === 'DeviceNotRegistered') {
      await db(`notification_devices?token=eq.${encodeURIComponent(token)}`, { method: 'DELETE' });
    }
    await db('notification_push_attempts', {
      method: 'POST',
      body: JSON.stringify({
        notificationid: notification.id, token, ticketid: ticket.id ?? null,
        status: ticket.status,
      }),
    });
  }
  await patchNotification(notification.id, { pushstatus: accepted > 0 ? 'sent' : 'failed' });
  return accepted > 0 ? 'sent' : 'failed';
}

async function checkReceipts() {
  const before = new Date(Date.now() - 15 * 60_000).toISOString();
  const attempts = await db<Attempt[]>(
    `notification_push_attempts?ticketid=not.is.null&checkedat=is.null` +
    `&createdat=lte.${encodeURIComponent(before)}&select=id,ticketid,token&limit=500`,
  );
  if (attempts.length === 0) return 0;
  const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
    },
    body: JSON.stringify({ ids: attempts.map((attempt) => attempt.ticketid) }),
  });
  if (!response.ok) throw new Error(`Expo receipt request failed (${response.status})`);
  const result = await response.json() as { data?: Record<string, ExpoTicket> };
  let checked = 0;
  for (const attempt of attempts) {
    const receipt = result.data?.[attempt.ticketid];
    if (!receipt) continue;
    if (receipt.details?.error === 'DeviceNotRegistered') {
      await db(`notification_devices?token=eq.${encodeURIComponent(attempt.token)}`, { method: 'DELETE' });
    }
    await db(`notification_push_attempts?id=eq.${attempt.id}`, {
      method: 'PATCH', body: JSON.stringify({ status: receipt.status, checkedat: new Date().toISOString() }),
    });
    checked++;
  }
  return checked;
}

Deno.serve(async (request) => {
  if (!supabaseUrl || !serviceKey || !workerSecret) return new Response('Server configuration is missing', { status: 500 });
  if (request.method !== 'POST' || request.headers.get('Authorization') !== `Bearer ${workerSecret}`) {
    return new Response('Forbidden', { status: 403 });
  }
  try {
    await db('rpc/requeue_stale_notification_pushes', { method: 'POST', body: '{}' });
    const notifications = await db<Notification[]>('rpc/claim_due_notification_pushes', {
      method: 'POST', body: JSON.stringify({ p_limit: 50 }),
    });
    const results: Record<string, number> = {};
    for (const notification of notifications) {
      try {
        const state = await send(notification);
        results[state] = (results[state] ?? 0) + 1;
      } catch (error) {
        console.error('Notification delivery error', notification.id, error);
        await retry(notification);
        results.retry = (results.retry ?? 0) + 1;
      }
    }
    const receipts = await checkReceipts();
    return Response.json({ claimed: notifications.length, results, receipts });
  } catch (error) {
    console.error('Notification worker error', error);
    return Response.json({ error: 'Notification worker failed' }, { status: 500 });
  }
});
