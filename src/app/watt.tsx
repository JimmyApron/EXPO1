import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { useRooms } from '@/hooks/use-rooms';
import { useTheme } from '@/hooks/use-theme';
import { notifyWattBalanceChanged, useWattBalance, wattAction, type WattSnapshot } from '@/hooks/use-watt';

type Product = { id: string; scope: 'personal'|'team'|'topup'; label: string; price_krw: number; student_price_krw: number|null; duration_days: number|null; included_units: number; cycle_days: number|null };
type History = { purchases: Record<string, unknown>[]; usage: Record<string, unknown>[] };
type HistoryEntry = { kind: 'purchase'|'usage'; item: Record<string, unknown>; key: string; createdAt: string };
type Preview = { starts_at: string; ends_at: string; next_renewal_at: string; next_grant_at: string|null; price_krw: number; included_units: number; duration_days: number; cycle_days: number|null; simulated: boolean };
type Entitlement = WattSnapshot['entitlements'][number];
const formatDate = (value?: string|null) => value ? new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric'}).format(new Date(value)) : '—';
const prices = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;
const displayProductLabel = (label: string) => label;
const remainingDays = (value: string) => Math.max(0,Math.ceil((new Date(value).getTime()-Date.now())/86400000));
const productName = (id?: string) => id==='personal_30'?'개인 30일 구독':id==='personal_120'?'개인 120일 구독':id==='team_30'?'팀 30일 구독':id==='team_120'?'팀 120일 구독':id==='trial_personal'?'개인 무료체험':id==='trial_team'?'팀 무료체험':'Watt 구독';
const featureName = (feature: string) => ({
  'extract-candidate-ideas': '아이디어 추출', 'extract-candidate-ideas-image': '이미지 분석',
  'analyze-idea-draft': '아이디어 분석', 'analyze-final-ideas': '최종 아이디어 분석',
  'generate-mvp': 'MVP 계획', 'generate-presentation': '발표자료 생성',
  'workspace-resource': '자료 요약', 'workspace-polish': '문장 다듬기',
} as Record<string, string>)[feature] ?? feature.replace(/^workspace-/, '문서 ');
const usageState = (item: Record<string, unknown>) => item.state === 'refunded' ? '복구 완료'
  : item.state === 'reserved' ? '실행 중'
  : item.usage_kind === 'subscription_free' ? '구독 혜택'
  : item.usage_kind === 'trial_free' ? '무료체험 혜택' : 'AI 단위 사용';
const resetTime = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));

export default function WattScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ roomId?: string }>();
  const { rooms, isloadingrooms, roomerror } = useRooms();
  const { balance, loading, error, refresh, trialUsed } = useWattBalance();
  const [products,setProducts] = useState<Product[]>([]);
  const [scope,setScope] = useState<'personal'|'team'>('personal');
  const [roomId,setRoomId] = useState(typeof params.roomId === 'string' ? params.roomId : '');
  const [selected,setSelected] = useState<Product|null>(null);
  const [preview,setPreview] = useState<Preview|null>(null);
  const [confirm,setConfirm] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [history,setHistory] = useState<History|null>(null);
  const [historyExpanded,setHistoryExpanded] = useState(false);
  const [teamBalances,setTeamBalances] = useState<Record<string,WattSnapshot>>({});
  const [loadedTeamBalancesKey,setLoadedTeamBalancesKey] = useState<string|null>(null);
  const [teamBalanceError,setTeamBalanceError] = useState(false);
  const teamLoadId = useRef(0);
  const [manageTarget,setManageTarget] = useState<{action:'cancel'|'resume'; entitlement:Entitlement}|null>(null);
  const [trialChooser,setTrialChooser] = useState(false);
  const [trialConfirm,setTrialConfirm] = useState(false);
  const [trialScope,setTrialScope] = useState<'personal'|'team'>('personal');
  const [trialRoomId,setTrialRoomId] = useState('');

  const ownedRooms = useMemo(() => rooms.filter(item => item.membership.role === 'owner'), [rooms]);
  const roomIdsKey = useMemo(() => rooms.map(item => item.room.id).join(','), [rooms]);
  const selectedRoom = rooms.find(item => item.room.id === roomId);
  const teamBalance = teamBalances[roomId] ?? null;
  const activeTeamCards = rooms.flatMap(item => {
    const snapshot = teamBalances[item.room.id];
    if (!snapshot) return [];
    const entitlement = snapshot.entitlements.find(value => value.room_id === item.room.id && value.state !== 'expired');
    return entitlement ? [{item,snapshot,entitlement}] : [];
  });
  const historyEntries = useMemo<HistoryEntry[]>(() => [
    ...(history?.purchases ?? []).map((item,index) => ({kind:'purchase' as const,item,key:`purchase-${String(item.id??index)}`,createdAt:String(item.created_at??'')})),
    ...(history?.usage ?? []).map((item,index) => ({kind:'usage' as const,item,key:`usage-${String(item.id??index)}`,createdAt:String(item.created_at??'')})),
  ].sort((a,b) => (Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0)), [history]);
  const personalActive = balance?.entitlements.find(item => item.room_id === null && item.state !== 'expired');
  const hasActiveEntitlement = Boolean(personalActive) || activeTeamCards.length > 0;
  const teamStatusReady = !isloadingrooms && !roomerror && loadedTeamBalancesKey === roomIdsKey && !teamBalanceError;
  const teamActive = teamBalance?.entitlements?.find(item => item.room_id === roomId && item.state !== 'expired');
  const personalExpired = balance?.entitlements.filter(item => item.room_id === null && item.state === 'expired').sort((a,b) => new Date(b.ends_at).getTime()-new Date(a.ends_at).getTime())[0];
  const teamExpired = teamBalance?.entitlements?.filter(item => item.room_id === roomId && item.state === 'expired').sort((a,b) => new Date(b.ends_at).getTime()-new Date(a.ends_at).getTime())[0];
  const expiredEntitlement = scope === 'team' ? teamExpired : personalExpired;
  const currentEntitlement = scope === 'team' ? teamActive : personalActive;
  const available = products.filter(item => scope === 'team' ? item.scope === 'team' && item.id.startsWith('team_') : item.scope === 'personal' && item.id.startsWith('personal_'));

  const loadProducts = useCallback(async () => {
    try { setProducts(await wattAction<Product[]>({ action:'products' }) ?? []); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : '상품 목록을 불러오지 못했습니다.'); }
  }, []);
  const loadHistory = useCallback(async () => {
    try { setHistory(await wattAction<History>({ action:'history' })); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : '이용 내역을 불러오지 못했습니다.'); }
  }, []);
  useFocusEffect(useCallback(() => { setHistoryExpanded(false); }, []));
  const loadTeamBalances = useCallback(async () => {
    const requestId = ++teamLoadId.current;
    const ids = roomIdsKey ? roomIdsKey.split(',') : [];
    if (!ids.length) { setTeamBalances({}); setLoadedTeamBalancesKey(roomIdsKey); setTeamBalanceError(false); return; }
    const results = await Promise.allSettled(ids.map(id => wattAction<{team:WattSnapshot|null}>({action:'state',roomId:id})));
    if (requestId !== teamLoadId.current) return;
    const next: Record<string,WattSnapshot> = {};
    results.forEach((result,index) => {
      if (result.status === 'fulfilled' && result.value.team) next[ids[index]] = result.value.team;
    });
    setTeamBalances(next);
    setLoadedTeamBalancesKey(roomIdsKey);
    setTeamBalanceError(results.some(result => result.status === 'rejected'));
  }, [roomIdsKey]);
  useEffect(() => {
    const timeout=globalThis.setTimeout(()=>{void loadProducts();void loadHistory();},0);
    return()=>globalThis.clearTimeout(timeout);
  }, [loadProducts,loadHistory]);
  useEffect(() => { const timeout=globalThis.setTimeout(()=>{void loadTeamBalances();},0);return()=>globalThis.clearTimeout(timeout); }, [loadTeamBalances]);
  useEffect(() => {
    const reset = Object.values(teamBalances).map(value => value.textUsage?.resetsAt).filter((value): value is string => Boolean(value)).sort()[0];
    if (!reset) return;
    const timeout = globalThis.setTimeout(() => { void Promise.all([loadTeamBalances(), loadHistory()]); }, Math.max(1000, new Date(reset).getTime() - Date.now() + 1000));
    return () => globalThis.clearTimeout(timeout);
  }, [teamBalances, loadTeamBalances, loadHistory]);
  useEffect(() => {
    if (roomId || !ownedRooms.length) return;
    const timeout=globalThis.setTimeout(()=>setRoomId(ownedRooms[0].room.id),0);
    return()=>globalThis.clearTimeout(timeout);
  }, [ownedRooms,roomId]);

  useRealtimeRefresh({
    channelName:`watt-details-${roomId || 'personal'}`,
    enabled:true,
    onRefresh:()=>Promise.all([refresh(),loadHistory(),loadTeamBalances()]),
    tables:[
      'watt_entitlements','watt_grants','watt_purchases','watt_trials','watt_usage',
      ...(roomId ? [
        {table:'watt_entitlements',filter:`room_id=eq.${roomId}`},
        {table:'watt_grants',filter:`owner_id=eq.${roomId}`},
        {table:'watt_purchases',filter:`room_id=eq.${roomId}`},
        {table:'watt_usage',filter:`room_id=eq.${roomId}`},
      ] : []),
    ],
  });

  const run = async (body: Record<string,unknown>, success: string) => {
    setBusy(true); setMessage('');
    try { await wattAction(body); setMessage(success); notifyWattBalanceChanged(); await Promise.all([refresh(),loadHistory(),loadTeamBalances()]); return true; }
    catch(reason) { setMessage(reason instanceof Error ? reason.message : '요청을 처리하지 못했습니다.'); return false; }
    finally { setBusy(false); }
  };

  const openTrialChooser = () => {
    setTrialScope(scope);
    setTrialRoomId(roomId || ownedRooms[0]?.room.id || '');
    setTrialChooser(true);
  };
  const startTrial = async () => {
    if (trialScope === 'team' && !trialRoomId) return;
    setBusy(true); setMessage('');
    try {
      await wattAction({action:'trial',scope:trialScope,roomId:trialScope==='team'?trialRoomId:null});
      setScope(trialScope);
      if (trialScope === 'team') setRoomId(trialRoomId);
      setMessage('7일 무료체험이 시작되었습니다.');
      setTrialChooser(false);
      setTrialConfirm(false);
      notifyWattBalanceChanged();
      try {
        const [historyResult] = await Promise.all([
          wattAction<History>({action:'history'}),
          refresh(),
          loadTeamBalances(),
        ]);
        setHistory(historyResult);
      } catch {
        await refresh();
        setMessage('무료체험은 시작되었습니다. 이용량을 새로 불러오지 못해 잠시 후 다시 확인해 주세요.');
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '무료체험을 시작하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const chooseProduct = async (product: Product) => {
    setSelected(product);
    if (product.scope === 'topup') { setPreview(null); setConfirm(true); return; }
    setBusy(true);
    try {
      const result=await wattAction<Preview>({action:'preview',productId:product.id,roomId:scope==='team'?roomId:null});
      setPreview(result); setConfirm(true);
    } catch(reason) { setMessage(reason instanceof Error ? reason.message : '신청 정보를 불러오지 못했습니다.'); }
    finally { setBusy(false); }
  };
  const activate = async () => {
    if (!selected) return;
    const isTopup=selected.scope==='topup';
    const ok=await run({action:isTopup?'topup':'activate',productId:selected.id,roomId:scope==='team'?roomId:null},isTopup?'AI 추가 이용량을 활성화했습니다.':'');
    if(ok) { setConfirm(false);setSelected(null);setPreview(null); }
  };

  const trialCard = teamStatusReady && !trialUsed && !hasActiveEntitlement ? (
    <ThemedView type="backgroundElement" style={[styles.trialCard,{backgroundColor:theme.primarySoft,borderColor:theme.primary}]}>
      <View style={styles.trialHead}><ThemedText type="caption" style={{color:theme.warning}}>첫 이용 혜택</ThemedText><ThemedText type="sectionTitle">Watt AI 7일 무료체험</ThemedText></View>
      <ThemedText type="small" themeColor="textSecondary">이용권을 구매하기 전에 Watt의 AI 기능을 무료로 경험해 보세요.</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">개인 20단위 · 팀 공동 60단위 · 이용 기간 7일</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">일반 텍스트 AI: 개인 총 25회·하루 10회 / 팀 총 75회·하루 30회</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">체험 중 프리미엄 발표자료 테마 이용 가능 · 종료 후 자동 유료 전환 없음</ThemedText>
      <Pressable disabled={busy} onPress={openTrialChooser} style={[styles.primaryButton,{backgroundColor:theme.primary,opacity:busy?0.5:1}]}><ThemedText type="smallBold">7일 무료체험 시작하기</ThemedText></Pressable>
      <ThemedText type="caption" themeColor="textSecondary">계정당 최초 1회 · 자동 결제 없음</ThemedText>
    </ThemedView>
  ) : null;

  return <ScrollView style={{backgroundColor:theme.background}} contentContainerStyle={styles.scroll}>
    <SafeAreaView edges={['top','bottom']} style={styles.safe}>
      <View style={styles.container}>
        <Pressable accessibilityRole="button" onPress={()=>router.canGoBack()?router.back():router.replace('/profile')} style={styles.back}><ThemedText type="smallBold">← 뒤로 가기</ThemedText></Pressable>
        <View style={styles.header}><ThemedText type="screenTitle">Watt 이용권</ThemedText><ThemedText type="body" themeColor="textSecondary">이용권과 AI 사용량을 관리해요.</ThemedText></View>
        {message ? <ThemedView style={[styles.notice,{borderColor:theme.border,backgroundColor:theme.primarySoft}]}><ThemedText type="small">{message}</ThemedText></ThemedView> : null}
        {error ? <ThemedText type="small" style={{color:theme.danger}}>{error}</ThemedText> : null}

        {trialCard}
        {personalActive && balance ? <ActiveEntitlementCard entitlement={personalActive} snapshot={balance} kind="personal" busy={busy} onManage={(action,entitlement)=>setManageTarget({action,entitlement})} /> : null}
        {activeTeamCards.map(({item,snapshot,entitlement}) => <ActiveEntitlementCard key={item.room.id} entitlement={entitlement} snapshot={snapshot} kind="team" roomName={item.room.name} canManage={item.membership.role==='owner'} busy={busy} onManage={(action,target)=>setManageTarget({action,entitlement:target})} />)}
        {!teamStatusReady ? <ThemedText type="caption" themeColor="textSecondary">{roomerror ? '팀 방 목록을 불러오지 못해 팀 이용권을 확인할 수 없습니다.' : loadedTeamBalancesKey === roomIdsKey && teamBalanceError ? '일부 팀 이용권을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.' : '팀 이용권을 확인 중입니다.'}</ThemedText> : null}
        {teamStatusReady && !hasActiveEntitlement && expiredEntitlement ? <ThemedView type="backgroundElement" style={[styles.statusCard,{borderColor:theme.border}]}><ThemedText type="smallBold">이용 종료</ThemedText><ThemedText type="sectionTitle">{productName(expiredEntitlement.product_id)}</ThemedText><ThemedText type="small" themeColor="textSecondary">이용 종료일 {formatDate(expiredEntitlement.ends_at)}</ThemedText></ThemedView> : null}
        {teamStatusReady && !hasActiveEntitlement && !expiredEntitlement && !trialCard ? <ThemedView type="backgroundElement" style={[styles.statusCard,{borderColor:theme.border}]}><ThemedText type="smallBold">{scope==='team'?'팀 이용권 없음':'FREE · 무료 플랜'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{scope==='team'?`선택한 팀의 공동 AI 잔여량 ${teamBalance?`${teamBalance.total}단위`:'확인 중'}`:`가입 기본 제공량을 포함해 개인 AI 잔여량 ${loading?'…':`${balance?.total??0}단위`}`}</ThemedText></ThemedView> : null}

        {!currentEntitlement ? <ThemedView type="backgroundElement" style={[styles.balanceCard,{borderColor:theme.border}]}><View style={styles.rowBetween}><View><ThemedText type="smallBold">{scope==='team'?'팀 공동 AI 잔여량':'내 개인 AI 사용량'}</ThemedText><ThemedText type="screenTitle" style={{color:theme.primary}}>{scope==='team'?(teamBalance?`${teamBalance.total}단위`:'확인 중'):(loading?'…':`${balance?.total??0}단위`)}</ThemedText></View><AppIcon name="idea" color={theme.primary} size={24}/></View><ThemedText type="caption" themeColor="textSecondary">{scope==='team'?'선택한 팀 방의 공동 잔여량 · 개인 잔여량과 별도':'개인 계정 잔여량 · 팀 공동 사용량과 별도'}</ThemedText></ThemedView> : null}
        {!currentEntitlement && scope==='personal' ? <ThemedText type="small" themeColor="textSecondary">가입 시 개인 계정에 기본 AI 12단위가 한 번 제공됩니다. 기본 과제 기능과 모든 과제 템플릿은 무료입니다. AI 작업은 기능별로 단위가 차감됩니다.</ThemedText> : null}
        <ThemedText type="caption" themeColor="textSecondary">AI 단위 안내 · 아이디어 추출·분석·문장 다듬기·자료 요약 1단위 · MVP 계획 2단위 · 이미지 분석 5단위 · 새 발표자료 생성 4단위. 구독·체험의 일반 텍스트 작업은 해당 한도 안에서 0단위입니다.</ThemedText>

        <View style={styles.sectionHead}><ThemedText type="sectionTitle">구독 상품</ThemedText><ThemedText type="small" themeColor="textSecondary">기간과 제공량을 비교해 선택하세요</ThemedText></View>
        <View style={styles.segment}>{(['personal','team'] as const).map(value=><Pressable key={value} onPress={()=>{setScope(value);setSelected(null);}} style={[styles.segmentItem,{backgroundColor:scope===value?theme.primarySoft:theme.surface,borderColor:scope===value?theme.primary:theme.border}]}><ThemedText type="smallBold">{value==='personal'?'개인 이용권':'팀 이용권'}</ThemedText></Pressable>)}</View>
        <View style={[styles.productGroup,{borderColor:'#F8BB54'}]}>
        {scope==='team' ? <ThemedView type="backgroundElement" style={[styles.roomBox,{borderColor:theme.border}]}><ThemedText type="smallBold">적용할 팀 방</ThemedText>{ownedRooms.length===0 ? <ThemedText type="small" themeColor="textSecondary">팀 구독을 이용하려면 먼저 팀 방을 생성해 주세요.</ThemedText> : ownedRooms.map(item=><Pressable key={item.room.id} onPress={()=>{setRoomId(item.room.id);setSelected(null);}} style={[styles.roomOption,{borderColor:roomId===item.room.id?theme.primary:theme.border,backgroundColor:roomId===item.room.id?theme.primarySoft:theme.surface}]}><ThemedText type="smallBold">{item.room.name}</ThemedText><ThemedText type="caption" themeColor="textSecondary">{item.members.length}/5명 {roomId===item.room.id?'✓':''}</ThemedText></Pressable>)}</ThemedView> : null}

        {available.map(product=><Pressable key={product.id} accessibilityRole="button" accessibilityState={{selected:selected?.id===product.id}} onPress={()=>setSelected(product)}><ThemedView type="backgroundElement" style={[styles.product,{borderColor:selected?.id===product.id?theme.primary:theme.border,backgroundColor:selected?.id===product.id?theme.primarySoft:theme.surface}]}>
          <View style={styles.rowBetween}><ThemedText type="sectionTitle">{product.label}</ThemedText><ThemedText type="sectionTitle" style={{color:theme.text}}>{prices(product.price_krw)}</ThemedText></View>
          {product.student_price_krw ? <ThemedText type="caption" themeColor="textSecondary">대학생 인증가 {prices(product.student_price_krw)}</ThemedText> : null}
          <ThemedText type="small" themeColor="textSecondary">{product.duration_days}일 이용 · {product.cycle_days?`${product.cycle_days}일마다 ${product.included_units}단위 갱신`:`${product.included_units}단위 / ${product.duration_days}일`}{scope==='team'?' · 방 공동 사용':''}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">일반 텍스트 AI 사용량 차감 없음 · 일일 공정 이용 한도 적용 ({scope==='team'?'팀 120회, 팀원별 40회':'개인 40회'}) · 프리미엄 발표자료 테마</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">자동 갱신 · 해지 전까지 같은 주기로 갱신</ThemedText>
          {selected?.id===product.id?<ThemedText type="caption" style={{color:theme.warning}}>✓ 선택됨</ThemedText>:null}
        </ThemedView></Pressable>)}
        <Pressable disabled={busy||!selected||selected.scope==='topup'||Boolean(currentEntitlement)|| (scope==='team'&&!roomId)} onPress={()=>selected&&void chooseProduct(selected)} style={[styles.primaryButton,{backgroundColor:theme.primary,opacity:busy||!selected||Boolean(currentEntitlement)?0.5:1}]}>{busy?<ActivityIndicator color={theme.text}/>:<ThemedText type="smallBold">이 이용권으로 계속하기</ThemedText>}</Pressable>

        <View style={styles.sectionHead}><ThemedText type="sectionTitle">AI 추가 이용권</ThemedText></View>
        <ThemedText type="caption" themeColor="textSecondary">추가 사용량은 {scope==='team'?`팀 ${selectedRoom?.room.name??'방'} 공동 잔여량`:'개인 계정'}에 적립됩니다.</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">추가 이용권만으로는 일반 텍스트 AI 무차감 혜택과 프리미엄 발표자료 테마를 이용할 수 없습니다.</ThemedText>
        <View style={styles.segment}>{products.filter(p=>p.scope==='topup').map(product=><Pressable key={product.id} disabled={busy||(scope==='team'&&!roomId)} onPress={()=>void chooseProduct(product)} style={[styles.topup,{borderColor:theme.border,backgroundColor:theme.surface,opacity:busy||(scope==='team'&&!roomId)?0.5:1}]}><ThemedText type="smallBold">{displayProductLabel(product.label)} · {product.included_units}단위</ThemedText><ThemedText type="caption">{prices(product.price_krw)}</ThemedText></Pressable>)}</View>
        </View>

        <View style={styles.sectionHead}><ThemedText type="sectionTitle">이용 내역</ThemedText></View>
        {historyEntries.length ? (historyExpanded ? historyEntries : historyEntries.slice(0,3)).map(({kind,item,key}) => kind==='purchase'
          ? <View key={key} style={styles.historyRow}><View style={{flex:1}}><ThemedText type="smallBold">{displayProductLabel(String((item.watt_products as {label?:string}|null)?.label??item.product_id??'이용권'))}</ThemedText><ThemedText type="caption" themeColor="textSecondary">{formatDate(String(item.created_at??''))}</ThemedText></View><ThemedText type="small">{prices(Number(item.displayed_price_krw??0))}</ThemedText></View>
          : <View key={key} style={styles.historyRow}><View style={{flex:1}}><ThemedText type="smallBold">{featureName(String(item.feature))} · {usageState(item)}</ThemedText><ThemedText type="caption" themeColor="textSecondary">{formatDate(String(item.created_at??''))}{item.state==='refunded'?' · 사용량 복구됨':''}</ThemedText></View><ThemedText type="small">{item.state==='refunded'?'복구':`${String(item.units)}단위`}</ThemedText></View>) : <ThemedText type="small" themeColor="textSecondary">아직 이용 내역이 없습니다.</ThemedText>}
        {historyEntries.length >= 4 ? <Pressable accessibilityRole="button" accessibilityState={{expanded:historyExpanded}} onPress={()=>setHistoryExpanded(value=>!value)} style={[styles.outlineButton,{borderColor:theme.border}]}><ThemedText type="smallBold">{historyExpanded?'접기':'더보기'}</ThemedText></Pressable> : null}
      </View>
    </SafeAreaView>

    <Modal visible={trialChooser} transparent animationType="fade" onRequestClose={()=>setTrialChooser(false)}>
      <View style={[styles.modalOverlay,{backgroundColor:theme.overlay}]}><ThemedView type="surfaceElevated" style={[styles.confirmCard,{borderColor:theme.border},Shadows.floating]}>
        <ThemedText type="sectionTitle">무료체험 유형 선택</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">체험을 적용할 이용 유형을 선택해 주세요.</ThemedText>
        <View style={styles.segment}>{(['personal','team'] as const).map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:trialScope===value}} onPress={()=>setTrialScope(value)} style={[styles.segmentItem,{backgroundColor:trialScope===value?theme.primarySoft:theme.surface,borderColor:trialScope===value?theme.primary:theme.border}]}><ThemedText type="smallBold">{value==='personal'?'개인 체험':'팀 체험'}</ThemedText></Pressable>)}</View>
        {trialScope==='team' ? <View style={styles.trialRoomList}><ThemedText type="smallBold">체험을 적용할 팀 방</ThemedText>{ownedRooms.length ? ownedRooms.map(item=><Pressable key={item.room.id} onPress={()=>setTrialRoomId(item.room.id)} style={[styles.roomOption,{borderColor:trialRoomId===item.room.id?theme.primary:theme.border,backgroundColor:trialRoomId===item.room.id?theme.primarySoft:theme.surface}]}><ThemedText type="smallBold">{item.room.name}</ThemedText><ThemedText type="caption" themeColor="textSecondary">{trialRoomId===item.room.id?'선택됨':''}</ThemedText></Pressable>) : <ThemedText type="caption" themeColor="textSecondary">팀 체험을 시작하려면 먼저 팀 방을 만들어 주세요.</ThemedText>}</View> : null}
        <View style={styles.segment}><Pressable onPress={()=>setTrialChooser(false)} style={[styles.modalButton,{borderColor:theme.border}]}><ThemedText type="smallBold">취소</ThemedText></Pressable><Pressable disabled={trialScope==='team'&&(!trialRoomId||!ownedRooms.some(item=>item.room.id===trialRoomId))} onPress={()=>{setTrialChooser(false);setTrialConfirm(true);}} style={[styles.modalButton,{backgroundColor:theme.primary,opacity:trialScope==='team'&&(!trialRoomId||!ownedRooms.some(item=>item.room.id===trialRoomId))?0.5:1}]}><ThemedText type="smallBold">계속</ThemedText></Pressable></View>
      </ThemedView></View>
    </Modal>

    <Modal visible={trialConfirm} transparent animationType="fade" onRequestClose={()=>setTrialConfirm(false)}>
      <View style={[styles.modalOverlay,{backgroundColor:theme.overlay}]}><ThemedView type="surfaceElevated" style={[styles.confirmCard,{borderColor:theme.border},Shadows.floating]}>
        <ThemedText type="sectionTitle">무료체험 최종 확인</ThemedText>
        <ThemedText type="body">{trialScope==='team'?`팀 체험 · ${ownedRooms.find(item=>item.room.id===trialRoomId)?.room.name??'팀 방'}`:'개인 체험'}</ThemedText>
        <View style={styles.previewRows}>
          <PreviewRow label="이용 기간" value="7일" />
          <PreviewRow label="AI 제공량" value={trialScope==='team'?'공동 60단위':'20단위'} />
          <PreviewRow label="일반 텍스트 AI" value={trialScope==='team'?'총 75회 · 팀 하루 30회':'총 25회 · 하루 10회'} />
          <PreviewRow label="프리미엄 테마" value="체험 기간 중 이용 가능" />
          <PreviewRow label="이용 요금" value="0원" />
          <PreviewRow label="자동 결제" value="없음" />
          <PreviewRow label="사용 제한" value="계정당 최초 1회" />
        </View>
        <ThemedText type="caption" themeColor="textSecondary">최종 확인을 누르면 서버에서 무료체험이 시작되며, 시작 시점부터 7일간 이용할 수 있습니다.</ThemedText>
        <View style={styles.segment}><Pressable disabled={busy} onPress={()=>setTrialConfirm(false)} style={[styles.modalButton,{borderColor:theme.border}]}><ThemedText type="smallBold">취소</ThemedText></Pressable><Pressable disabled={busy} onPress={()=>void startTrial()} style={[styles.modalButton,{backgroundColor:theme.primary,opacity:busy?0.6:1}]}>{busy?<ActivityIndicator color={theme.text}/>:<ThemedText type="smallBold">무료체험 시작</ThemedText>}</Pressable></View>
      </ThemedView></View>
    </Modal>

    <Modal visible={confirm} transparent animationType="fade" onRequestClose={()=>setConfirm(false)}>
      <View style={[styles.modalOverlay,{backgroundColor:theme.overlay}]}><ThemedView type="surfaceElevated" style={[styles.confirmCard,{borderColor:theme.border},Shadows.floating]}>
        <ThemedText type="sectionTitle">{selected?.scope==='topup'?'AI 추가 이용권':'구독 신청'}</ThemedText>
        <ThemedText type="body">{selected?.label} · {selected?prices(selected.price_krw):''}</ThemedText>
        {selected?.scope==='topup' ? <ThemedText type="small" themeColor="textSecondary">{selected.included_units}단위 추가 · {scope==='team'?selectedRoom?.room.name??'팀 방':'내 개인 계정'} · 추가 이용권만으로 구독 혜택은 제공되지 않습니다.</ThemedText> : <>
          <View style={styles.previewRows}><PreviewRow label="이용 시작" value={formatDate(preview?.starts_at)}/><PreviewRow label="다음 결제 예정일" value={formatDate(preview?.next_renewal_at)}/><PreviewRow label="AI 제공량" value={selected?.cycle_days?`${selected.cycle_days}일마다 ${selected.included_units}단위`:`${selected?.included_units}단위 / ${selected?.duration_days}일`}/>{selected?.cycle_days?<PreviewRow label="다음 AI 제공량 갱신" value={formatDate(preview?.next_grant_at)}/>:null}{scope==='team'?<PreviewRow label="적용 팀 방" value={selectedRoom?.room.name??'—'}/>:null}</View>
          <ThemedText type="small" themeColor="textSecondary">구독은 별도의 해지 신청이 없는 경우 동일한 상품으로 자동 갱신됩니다. 해지 신청 시 다음 갱신이 중단되며, 현재 이용 기간 종료일까지 서비스를 이용할 수 있습니다.</ThemedText>
        </>}
        <View style={styles.segment}><Pressable onPress={()=>setConfirm(false)} style={[styles.modalButton,{borderColor:theme.border}]}><ThemedText type="smallBold">취소</ThemedText></Pressable><Pressable disabled={busy||(!preview&&selected?.scope!=='topup')} onPress={()=>void activate()} style={[styles.modalButton,{backgroundColor:theme.primary}]}>{busy?<ActivityIndicator/>:<ThemedText type="smallBold">{selected?.scope==='topup'?'추가하기':'구독 신청하기'}</ThemedText>}</Pressable></View>
      </ThemedView></View>
    </Modal>

    <Modal visible={Boolean(manageTarget)} transparent animationType="fade" onRequestClose={()=>setManageTarget(null)}>
      <View style={[styles.modalOverlay,{backgroundColor:theme.overlay}]}><ThemedView type="surfaceElevated" style={[styles.confirmCard,{borderColor:theme.border},Shadows.floating]}>
        <ThemedText type="sectionTitle">{manageTarget?.action==='cancel'?'구독을 해지하시겠어요?':'구독을 계속 유지하시겠어요?'}</ThemedText>
        {manageTarget?.action==='cancel' ? <><ThemedText type="small">현재 구독: {productName(manageTarget.entitlement.product_id)}</ThemedText><ThemedText type="small">이용 종료일 {formatDate(manageTarget.entitlement.ends_at)} · 남은 기간 {remainingDays(manageTarget.entitlement.ends_at)}일</ThemedText><ThemedText type="small" themeColor="textSecondary">다음 자동 갱신은 진행되지 않습니다. 현재 이용 기간이 끝날 때까지 AI 기능과 남은 사용량을 정상적으로 이용할 수 있습니다.</ThemedText></> : <ThemedText type="small" themeColor="textSecondary">해지 예약을 취소하면 현재 이용 기간이 종료될 때 구독이 자동으로 갱신됩니다.</ThemedText>}
        <View style={styles.segment}><Pressable onPress={()=>setManageTarget(null)} style={[styles.modalButton,{borderColor:theme.border}]}><ThemedText type="smallBold">돌아가기</ThemedText></Pressable><Pressable disabled={busy||!manageTarget} onPress={async()=>{if(manageTarget&&await run({action:manageTarget.action,entitlementId:manageTarget.entitlement.id},manageTarget.action==='cancel'?'해지 예약이 완료되었습니다. 종료일까지 계속 이용할 수 있습니다.':'구독이 다시 유지됩니다.'))setManageTarget(null);}} style={[styles.modalButton,{borderColor:theme.border}]}>{busy?<ActivityIndicator/>:<ThemedText type="smallBold">{manageTarget?.action==='cancel'?'구독 해지하기':'구독 유지하기'}</ThemedText>}</Pressable></View>
      </ThemedView></View>
    </Modal>
  </ScrollView>;
}

function ActiveEntitlementCard({entitlement,snapshot,kind,roomName,canManage=true,busy,onManage}:{
  entitlement:Entitlement; snapshot:WattSnapshot; kind:'personal'|'team'; roomName?:string; canManage?:boolean; busy:boolean;
  onManage:(action:'cancel'|'resume',entitlement:Entitlement)=>void;
}) {
  const theme = useTheme();
  const [expanded,setExpanded] = useState(false);
  const textUsage = snapshot.textUsage;
  const textRemaining = textUsage ? Math.max(0,textUsage.dailyLimit-textUsage.todayUsed) : null;
  return <ThemedView type="backgroundElement" style={[styles.statusCard,{borderColor:theme.border},Shadows.card]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${productName(entitlement.product_id)} 상세 ${expanded?'접기':'펼치기'}`} accessibilityState={{expanded}} onPress={()=>setExpanded(value=>!value)} style={{gap:Spacing.two}}>
      <View style={styles.rowBetween}>
        <ThemedText type="caption" style={{color:entitlement.state==='cancel_scheduled'?theme.warning:theme.success}}>{entitlement.state==='cancel_scheduled'?'해지 예약':entitlement.trial?'무료체험 이용 중':'이용 중'}</ThemedText>
        <View style={styles.rowBetween}>
          {roomName ? <ThemedText type="caption" themeColor="textSecondary" style={{flexShrink:1,textAlign:'right'}}>{roomName}</ThemedText> : null}
          <View style={{transform:[{rotate:expanded?'270deg':'90deg'}]}}><AppIcon name="chevronRight" color={theme.textSecondary} size={20}/></View>
        </View>
      </View>
      <ThemedText type="sectionTitle">{productName(entitlement.product_id)}</ThemedText>
      <ThemedText type="smallBold">{kind==='team'?`팀 공동 잔여량 ${snapshot.total}단위`:`AI 잔여 사용량 ${snapshot.total}단위`}</ThemedText>
      {textUsage ? <ThemedText type="smallBold">{kind==='team'?'팀 전체':'개인'} 오늘 {textUsage.todayUsed}/{textUsage.dailyLimit}회 이용 · {textRemaining}회 남음</ThemedText> : <ThemedText type="caption" themeColor="textSecondary">오늘 이용 횟수를 확인 중입니다.</ThemedText>}
      {kind==='team' && textUsage && textUsage.memberLimit !== null ? <ThemedText type="smallBold">내가 오늘 이 팀에서 사용한 횟수 {textUsage.memberUsed}/{textUsage.memberLimit}회 · 팀원별 하루 한도</ThemedText> : null}
    </Pressable>
    {expanded ? <>
      <ThemedText type="small" themeColor="textSecondary">{entitlement.state==='cancel_scheduled'?`이용 종료일 ${formatDate(entitlement.ends_at)}`:`남은 이용 기간 ${remainingDays(entitlement.ends_at)}일`}</ThemedText>
      {entitlement.state==='cancel_scheduled' ? <ThemedText type="small" themeColor="textSecondary">현재 기간이 끝날 때까지 AI 기능과 남은 사용량을 정상적으로 이용할 수 있습니다.</ThemedText> : null}
      <ThemedText type="small" themeColor="textSecondary">{entitlement.trial ? '무료체험 일반 텍스트 AI' : '일반 텍스트 AI 사용량 차감 없음 · 일일 공정 이용 한도 적용 · 월간 누적 횟수 제한 없음'}</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">{entitlement.trial ? '체험 기간' : '구독 기간'} 중 프리미엄 발표자료 테마 이용 가능 · 이미지 분석과 새 발표자료 생성은 AI 단위 차감</ThemedText>
      {textUsage ? <>
        <ThemedText type="caption" themeColor="textSecondary">일일 사용량은 매일 24시에 초기화됩니다.</ThemedText>
        {textUsage.trialLimit !== null ? <ThemedText type="small" themeColor="textSecondary">체험 전체 {textUsage.trialUsed}/{textUsage.trialLimit}회 이용</ThemedText> : null}
        {textRemaining === 0 || (textUsage.memberLimit !== null && textUsage.memberUsed === textUsage.memberLimit) || (textUsage.trialLimit !== null && textUsage.trialUsed === textUsage.trialLimit) ? <ThemedText type="caption" themeColor="textSecondary">일일 한도는 {resetTime(textUsage.resetsAt)}에 초기화됩니다. 추가 사용은 작업별 AI 단위 차감에 동의한 경우에만 진행합니다.</ThemedText> : null}
      </> : null}
      {entitlement.trial ? null : entitlement.state==='cancel_scheduled' ? canManage ? <Pressable disabled={busy} onPress={()=>onManage('resume',entitlement)} style={[styles.outlineButton,{borderColor:theme.border}]}><ThemedText type="smallBold">구독 다시 유지하기</ThemedText></Pressable> : null : entitlement.auto_renew ? <View style={styles.rowBetween}><ThemedText type="caption" themeColor="textSecondary">다음 결제 예정일 {formatDate(entitlement.next_renewal_at)}</ThemedText>{canManage ? <Pressable disabled={busy} onPress={()=>onManage('cancel',entitlement)}><ThemedText type="caption" style={{color:theme.textTertiary,textDecorationLine:'underline'}}>구독 관리</ThemedText></Pressable> : null}</View> : <ThemedText type="caption" themeColor="textSecondary">이용 종료일 {formatDate(entitlement.ends_at)} · 자동 갱신 미설정</ThemedText>}
      {entitlement.next_grant_at ? <ThemedText type="caption" themeColor="textSecondary">다음 AI 제공량 갱신 {formatDate(entitlement.next_grant_at)}</ThemedText> : null}
    </> : null}
  </ThemedView>;
}

function PreviewRow({label,value}:{label:string;value:string}) { return <View style={styles.previewRow}><ThemedText type="caption" themeColor="textSecondary">{label}</ThemedText><ThemedText type="smallBold">{value}</ThemedText></View>; }

const styles=StyleSheet.create({scroll:{flexGrow:1,padding:Spacing.four,alignItems:'center'},safe:{width:'100%'},container:{width:'100%',maxWidth:760,gap:Spacing.three},productGroup:{borderWidth:2,borderRadius:Radius.large,padding:Spacing.three,gap:Spacing.three},back:{alignSelf:'flex-start'},header:{gap:4,marginBottom:Spacing.two},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:Spacing.two},sectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:Spacing.two},segment:{flexDirection:'row',gap:Spacing.two,flexWrap:'wrap'},segmentItem:{flex:1,minWidth:130,borderWidth:1,borderRadius:Radius.medium,padding:Spacing.two,alignItems:'center'},balanceCard:{borderWidth:1,borderRadius:Radius.large,padding:Spacing.three,gap:Spacing.two},statusCard:{borderWidth:1,borderRadius:Radius.large,padding:Spacing.three,gap:Spacing.two},trialCard:{borderWidth:1,borderRadius:Radius.large,padding:Spacing.three,gap:Spacing.two},trialHead:{gap:Spacing.one},trialRoomList:{gap:Spacing.two},roomBox:{borderWidth:1,borderRadius:Radius.large,padding:Spacing.three,gap:Spacing.two},roomOption:{borderWidth:1,borderRadius:Radius.medium,padding:Spacing.two,flexDirection:'row',justifyContent:'space-between',gap:Spacing.two},product:{borderWidth:1,borderRadius:Radius.large,padding:Spacing.three,gap:Spacing.two},primaryButton:{minHeight:46,borderRadius:Radius.medium,alignItems:'center',justifyContent:'center',paddingHorizontal:Spacing.three},outlineButton:{minHeight:40,borderWidth:1,borderRadius:Radius.medium,alignItems:'center',justifyContent:'center',paddingHorizontal:Spacing.three},topup:{flex:1,minWidth:150,borderWidth:1,borderRadius:Radius.medium,padding:Spacing.two,gap:4},historyRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:Spacing.two,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:'#E7DED0',gap:Spacing.two},notice:{borderWidth:1,borderRadius:Radius.medium,padding:Spacing.two},modalOverlay:{flex:1,justifyContent:'center',alignItems:'center',padding:Spacing.three},confirmCard:{width:'100%',maxWidth:480,borderWidth:1,borderRadius:Radius.large,padding:Spacing.four,gap:Spacing.three},previewRows:{gap:Spacing.two},previewRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:Spacing.three},modalButton:{flex:1,minHeight:44,borderWidth:1,borderRadius:Radius.medium,justifyContent:'center',alignItems:'center',padding:Spacing.two}});
