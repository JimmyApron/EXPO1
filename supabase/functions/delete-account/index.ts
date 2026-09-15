declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ message: 'POST 요청만 지원합니다.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ message: '서버 환경 변수가 설정되지 않았습니다.' }, 500);
  }
  if (!authorization) return json({ message: '로그인이 필요합니다.' }, 401);

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: anonKey },
  });
  if (!userResponse.ok) return json({ message: '유효하지 않은 로그인 정보입니다.' }, 401);

  const user = await userResponse.json();
  if (!user?.id) return json({ message: '유효하지 않은 로그인 정보입니다.' }, 401);

  const adminHeaders = {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
  };
  const avatarPath = user.user_metadata?.avatarpath;

  if (typeof avatarPath === 'string' && avatarPath) {
    const encodedPath = avatarPath.split('/').map(encodeURIComponent).join('/');
    await fetch(`${supabaseUrl}/storage/v1/object/avatars/${encodedPath}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
  }

  const profileDeleteResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  if (!profileDeleteResponse.ok) return json({ message: '프로필 데이터 삭제에 실패했습니다.' }, 500);

  const deleteResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  if (!deleteResponse.ok) return json({ message: '회원 탈퇴 처리에 실패했습니다.' }, 500);

  return json({ success: true });
});
