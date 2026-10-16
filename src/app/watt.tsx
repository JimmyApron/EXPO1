import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { useRooms } from '@/hooks/use-rooms';
import { useTheme } from '@/hooks/use-theme';
import { useWattBalance, wattAction, type WattSnapshot } from '@/hooks/use-watt';

type Product = { id: string; scope: 'personal'|'team'|'topup'; label: string; price_krw: number; student_price_krw: number|null; duration_days: number|null; included_units: number; cycle_days: number|null };
type History = { purchases: Record<string, unknown>[]; usage: Record<string, unknown>[] };
const formatDate = (value?: string|null) => value ? new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric'}).format(new Date(value)) : '—';
const prices = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;

export default function WattScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ roomId?: string }>();
  const { rooms } = useRooms();
  const { balance, loading, error, refresh, trialUsed } = useWattBalance();
  const [products,setProducts] = useState<Product[]>([]);
  const [scope,setScope] = useState<'personal'|'team'>('personal');
  const [roomId,setRoomId] = useState(typeof params.roomId === 'string' ? params.roomId : '');
  const [selected,setSelected] = useState<Product|null>(null);
  const [confirm,setConfirm] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [history,setHistory] = useState<History|null>(null);
  const [teamBalance,setTeamBalance] = useState<WattSnapshot|null>(null);
  const [cancelTarget,setCancelTarget] = useState<{id:string;productId:string;endsAt:string;remainingDays:number}|null>(null);

  const ownedRooms = useMemo(() => rooms.filter(item => item.membership.role === 'owner'), [rooms]);
  const loadProducts = useCallback(async () => {
    try { setProducts(await wattAction<Product[]>({ action: 'products' }) ?? []); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : '상품 목록을 불러오지 못했습니다.'); }
  }, []);
  const loadHistory = useCallback(async () => {
    try { setHistory(await wattAction<History>({ action: 'history' })); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : '이용 내역을 불러오지 못했습니다.'); }
  }, []);
  const loadTeamBalance = useCallback(async () => {
    if (!roomId) { setTeamBalance(null); return; }
    try { const result = await wattAction<{team: WattSnapshot|null}>({action:'state',roomId}); setTeamBalance(result.team); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : '팀 이용량을 불러오지 못했습니다.'); }
  }, [roomId]);
  useEffect(() => { const timeout=globalThis.setTimeout(()=>{void loadProducts();void loadHistory();},0);return()=>globalThis.clearTimeout(timeout); }, [loadProducts,loadHistory]);
  useEffect(() => { const timeout=globalThis.setTimeout(()=>{void loadTeamBalance();},0);return()=>globalThis.clearTimeout(timeout); }, [loadTeamBalance]);

  const run = async (body: Record<string,unknown>, success: string) => {
    setBusy(true); setMessage('');
    try { await wattAction(body); setMessage(success); await Promise.all([refresh(),loadHistory(),loadTeamBalance()]); return true; }
    catch(reason) { setMessage(reason instanceof Error ? reason.message : '요청을 처리하지 못했습니다.'); return false; }
    finally { setBusy(false); }
  };
  const entitlements = balance?.entitlements ?? [];
  const personalActive = entitlements.find(item => item.room_id === null && item.state !== 'expired');
  const selectedRoom = rooms.find(item => item.room.id === roomId);
  const teamActive = teamBalance?.entitlements?.find(item => item.room_id === roomId && item.state !== 'expired');
  const available = products.filter(item => scope === 'team' ? item.scope === 'team' && item.id.startsWith('team_') : item.scope === 'personal' && item.id.startsWith('personal_'));

  const beginActivation = (product: Product) => { setSelected(product); setConfirm(true); };
  const activate = async () => {
    if (!selected) return;
    const isTopup = selected.scope === 'topup';
    const success = isTopup
      ? `${selected.included_units}단위를 추가했습니다. 시연용 활성화로 실제 결제는 발생하지 않았습니다.`
      : '이용권이 활성화되었습니다. 시연용 활성화로 실제 결제는 발생하지 않았습니다.';
    const ok = await run({action:isTopup?'topup':'activate',productId:selected.id,roomId:scope === 'team' ? roomId : null},success);
    if(ok) { setConfirm(false); setSelected(null); }
  };

  return <ScrollView style={{backgroundColor:theme.background}} contentContainerStyle={styles.scroll}>
    <SafeAreaView edges={['top','bottom']} style={styles.safe}>
      <View style={styles.container}>
        <Pressable accessibilityRole="button" onPress={()=>router.back()} style={styles.back}><ThemedText type="smallBold">내 정보로 돌아가기</ThemedText></Pressable>
        <View style={styles.header}><ThemedText type="screenTitle">Watt 이용권</ThemedText><ThemedText type="body" themeColor="textSecondary">이용권과 AI 사용량을 관리해요.</ThemedText></View>
        {message ? <ThemedView style={[styles.notice,{borderColor:theme.border,backgroundColor:theme.primarySoft}]}><ThemedText type="small">{message}</ThemedText></ThemedView> : null}
        {error ? <ThemedText type="small" style={{color:theme.danger}}>{error}</ThemedText> : null}

        <ThemedView type="backgroundElement" style={[styles.balanceCard,{borderColor:theme.border},Shadows.card]}>
          <View style={styles.rowBetween}><View><ThemedText type="smallBold">내 AI 사용량</ThemedText><ThemedText type="screenTitle" style={{color:theme.primary}}>{loading ? '…' : `${balance?.total ?? 0}단위`}</ThemedText></View><AppIcon name="idea" color={theme.primary} size={28}/></View>
          <ThemedText type="small" themeColor="textSecondary">가입 기본 제공량, 기간 제공량, 추가 이용권 순서로 사용돼요.</ThemedText>
          {personalActive ? <ThemedText type="smallBold">{personalActive.product_id === 'personal_30' ? '개인 30일권' : personalActive.product_id === 'personal_120' ? '개인 120일권' : '무료체험'} · {personalActive.state === 'cancel_scheduled' ? '해지 예약' : '이용 중'} · 종료 {formatDate(personalActive.ends_at)}</ThemedText> : <ThemedText type="small">FREE · 무료 플랜 이용 중</ThemedText>}
          {personalActive?.state === 'active' ? <Pressable onPress={()=>setCancelTarget({id:personalActive.id,productId:personalActive.product_id,endsAt:personalActive.ends_at,remainingDays:Math.max(0,Math.ceil((new Date(personalActive.ends_at).getTime()-Date.now())/86400000))})}><ThemedText type="caption" style={{color:theme.textTertiary,textDecorationLine:'underline'}}>이용권 해지</ThemedText></Pressable> : null}
        </ThemedView>

        <View style={styles.sectionHead}><ThemedText type="sectionTitle">이용권 선택</ThemedText><ThemedText type="small" themeColor="textSecondary">자동 결제 없음</ThemedText></View>
        <View style={styles.segment}>
          {(['personal','team'] as const).map(value=><Pressable key={value} onPress={()=>setScope(value)} style={[styles.segmentItem,{backgroundColor:scope===value?theme.primarySoft:theme.surface,borderColor:theme.border}]}><ThemedText type="smallBold">{value==='personal'?'개인 이용권':'팀 이용권'}</ThemedText></Pressable>)}
        </View>
        {scope==='team' ? <ThemedView type="backgroundElement" style={[styles.roomBox,{borderColor:theme.border}]}>
          <ThemedText type="smallBold">적용할 팀 방</ThemedText>
          {ownedRooms.length===0 ? <ThemedText type="small" themeColor="textSecondary">팀 이용권을 사용하려면 먼저 팀 방을 생성해 주세요.</ThemedText> : ownedRooms.map(item=><Pressable key={item.room.id} onPress={()=>setRoomId(item.room.id)} style={[styles.roomOption,{borderColor:roomId===item.room.id?theme.primary:theme.border,backgroundColor:roomId===item.room.id?theme.primarySoft:theme.surface}]}><ThemedText type="smallBold">{item.room.name}</ThemedText><ThemedText type="caption" themeColor="textSecondary">{item.members.length}/5명</ThemedText></Pressable>)}
          {teamActive ? <><ThemedText type="smallBold">공동 잔여량 {teamBalance?.total ?? 0}단위 · 종료 {formatDate(teamActive.ends_at)}</ThemedText>{teamActive.state==='active'?<Pressable onPress={()=>setCancelTarget({id:teamActive.id,productId:teamActive.product_id,endsAt:teamActive.ends_at,remainingDays:Math.max(0,Math.ceil((new Date(teamActive.ends_at).getTime()-Date.now())/86400000))})}><ThemedText type="caption" style={{color:theme.textTertiary,textDecorationLine:'underline'}}>이용권 해지</ThemedText></Pressable>:null}</> : null}
        </ThemedView> : null}
        {available.map(product=><ThemedView key={product.id} type="backgroundElement" style={[styles.product,{borderColor:theme.border},Shadows.card]}>
          <View style={styles.rowBetween}><ThemedText type="sectionTitle">{product.label}</ThemedText><ThemedText type="sectionTitle" style={{color:theme.primary}}>{prices(product.price_krw)}</ThemedText></View>
          <ThemedText type="small" themeColor="textSecondary">{product.duration_days}일 이용 · {product.cycle_days ? `${product.cycle_days}일마다 ${product.included_units}단위 갱신` : `${product.included_units}단위 제공`}{scope==='team'?' · 방 공동 사용':''}</ThemedText>
          {product.student_price_krw ? <ThemedText type="caption" themeColor="textTertiary">대학생 인증가 {prices(product.student_price_krw)} · 학생 인증 연결 전에는 일반가가 적용됩니다.</ThemedText> : null}
          <Pressable disabled={busy || (scope==='team' && (!roomId || !selectedRoom || Boolean(teamActive))) || Boolean(scope==='personal' && personalActive)} onPress={()=>beginActivation(product)} style={[styles.primaryButton,{backgroundColor:theme.primary,opacity:busy || (scope==='team' && (!roomId || Boolean(teamActive))) || Boolean(scope==='personal' && personalActive)?0.5:1}]}><ThemedText type="smallBold">{scope==='team'&&teamActive?'이 방은 이용 중':'이 이용권 선택하기'}</ThemedText></Pressable>
        </ThemedView>)}

        {!trialUsed ? <ThemedView type="backgroundElement" style={[styles.trialCard,{borderColor:theme.border}]}>
          <ThemedText type="sectionTitle">Watt AI 7일 무료체험</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">개인 20단위 또는 팀 공동 60단위 · 계정당 최초 1회 · 자동 결제 없음</ThemedText>
          <Pressable disabled={busy || (scope==='team' && !roomId) || Boolean(scope==='personal' && personalActive)} onPress={()=>void run({action:'trial',scope,roomId:scope==='team'?roomId:null},'무료체험이 시작되었습니다.')} style={[styles.secondaryButton,{borderColor:theme.border,opacity:busy || Boolean(scope==='personal'&&personalActive)?0.5:1}]}><ThemedText type="smallBold">무료체험 시작하기</ThemedText></Pressable>
        </ThemedView> : null}

        <View style={styles.sectionHead}><ThemedText type="sectionTitle">AI 사용량 추가하기</ThemedText><ThemedText type="small" themeColor="textSecondary">개인 계정에 적립</ThemedText></View>
        <ThemedText type="caption" themeColor="textSecondary">적립 대상: {scope==='team'?`팀 ${selectedRoom?.room.name??'방을 선택하세요'}`:'내 개인 계정'}</ThemedText>
        <View style={styles.segment}>{products.filter(p=>p.scope==='topup').map(product=><Pressable key={product.id} disabled={busy || (scope==='team'&&!roomId)} onPress={()=>beginActivation(product)} style={[styles.topup,{borderColor:theme.border,backgroundColor:theme.surface,opacity:busy||(scope==='team'&&!roomId)?0.5:1}]}><ThemedText type="smallBold">{product.label} · {product.included_units}단위</ThemedText><ThemedText type="caption">{prices(product.price_krw)}</ThemedText></Pressable>)}</View>

        <View style={styles.sectionHead}><ThemedText type="sectionTitle">이용 내역</ThemedText><Pressable onPress={()=>void loadHistory()}><ThemedText type="smallBold" style={{color:theme.primary}}>새로고침</ThemedText></Pressable></View>
        {history?.purchases?.length ? history.purchases.map((purchase,index)=><View key={String(purchase.id??index)} style={styles.historyRow}><View style={{flex:1}}><ThemedText type="smallBold">{String((purchase.watt_products as {label?:string}|null)?.label ?? purchase.product_id ?? '이용권')}</ThemedText><ThemedText type="caption" themeColor="textSecondary">시연용 활성화 · {formatDate(String(purchase.created_at??''))}</ThemedText></View><ThemedText type="small">{prices(Number(purchase.displayed_price_krw??0))}</ThemedText></View>) : <ThemedText type="small" themeColor="textSecondary">아직 구매 내역이 없습니다.</ThemedText>}
        {history?.usage?.length ? <><ThemedText type="smallBold" style={{marginTop:Spacing.two}}>AI 사용 내역</ThemedText>{history.usage.slice(0,20).map((item,index)=><View key={String(item.id??index)} style={styles.historyRow}><View style={{flex:1}}><ThemedText type="smallBold">{String(item.feature)} · {String(item.state)}</ThemedText><ThemedText type="caption" themeColor="textSecondary">{formatDate(String(item.created_at??''))}</ThemedText></View><ThemedText type="small">−{String(item.units)}단위</ThemedText></View>)}</> : null}

        <ThemedView type="backgroundElement" style={[styles.note,{borderColor:theme.border}]}><ThemedText type="caption" themeColor="textSecondary">현재는 시연 버전으로 실제 결제, 자동 결제, 자동 갱신 및 환불이 제공되지 않습니다. 이용권을 확정하면 바로 활성화됩니다.</ThemedText></ThemedView>
      </View>
    </SafeAreaView>
    <Modal visible={confirm} transparent animationType="fade" onRequestClose={()=>setConfirm(false)}>
      <View style={[styles.modalOverlay,{backgroundColor:theme.overlay}]}><ThemedView type="surfaceElevated" style={[styles.confirmCard,{borderColor:theme.border},Shadows.floating]}>
        <ThemedText type="sectionTitle">{selected?.scope==='topup'?'추가 이용권을 구매할까요?':'이용권을 활성화할까요?'}</ThemedText>
        <ThemedText type="body">{selected?.label} · {selected?prices(selected.price_krw):''}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{selected?.scope==='topup'?`${selected?.included_units}단위 추가 · 대상 ${scope==='team'?selectedRoom?.room.name??'팀 방':'내 개인 계정'}`:`${selected?.duration_days}일 · ${selected?.included_units}단위${selected?.cycle_days?` / ${selected.cycle_days}일마다 갱신`:''}${scope==='team'?` · ${selectedRoom?.room.name??''}`:''}`}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">현재는 시연 버전으로 실제 결제가 진행되지 않습니다. 구매를 확정하면 이용권이 활성화됩니다. 환불은 제공되지 않습니다.</ThemedText>
        <View style={styles.segment}><Pressable onPress={()=>setConfirm(false)} style={[styles.modalButton,{borderColor:theme.border}]}><ThemedText type="smallBold">돌아가기</ThemedText></Pressable><Pressable disabled={busy} onPress={()=>void activate()} style={[styles.modalButton,{backgroundColor:theme.primary}]}>{busy?<ActivityIndicator/>:<ThemedText type="smallBold">이용권 활성화하기</ThemedText>}</Pressable></View>
      </ThemedView></View>
    </Modal>
    <Modal visible={Boolean(cancelTarget)} transparent animationType="fade" onRequestClose={()=>setCancelTarget(null)}>
      <View style={[styles.modalOverlay,{backgroundColor:theme.overlay}]}><ThemedView type="surfaceElevated" style={[styles.confirmCard,{borderColor:theme.border},Shadows.floating]}>
        <ThemedText type="sectionTitle">이용권을 해지하시겠어요?</ThemedText>
        <ThemedText type="small">현재 이용권: {cancelTarget?.productId==='personal_30'?'개인 30일권':cancelTarget?.productId==='personal_120'?'개인 120일권':cancelTarget?.productId?.startsWith('team_')?'팀 이용권':'무료체험'}</ThemedText>
        <ThemedText type="small">이용 종료일: {formatDate(cancelTarget?.endsAt)} · 남은 이용 기간 {cancelTarget?.remainingDays ?? 0}일</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">이용 종료일까지 남은 AI 사용량과 유료 기능을 정상적으로 사용할 수 있습니다. 종료일 이후 무료 플랜으로 전환되며 자동 결제는 없고 환불은 제공되지 않습니다.</ThemedText>
        <View style={styles.segment}><Pressable onPress={()=>setCancelTarget(null)} style={[styles.modalButton,{borderColor:theme.border}]}><ThemedText type="smallBold">돌아가기</ThemedText></Pressable><Pressable disabled={busy||!cancelTarget} onPress={async()=>{if(cancelTarget&&await run({action:'cancel',entitlementId:cancelTarget.id},'해지 예약이 완료되었습니다. 종료일까지 계속 이용할 수 있습니다.'))setCancelTarget(null)}} style={[styles.modalButton,{backgroundColor:theme.primary}]}><ThemedText type="smallBold">해지 예약하기</ThemedText></Pressable></View>
      </ThemedView></View>
    </Modal>
  </ScrollView>;
}

const styles=StyleSheet.create({scroll:{flexGrow:1,padding:Spacing.four,alignItems:'center'},safe:{width:'100%'},container:{width:'100%',maxWidth:760,gap:Spacing.three},back:{flexDirection:'row',alignItems:'center',gap:4,alignSelf:'flex-start'},header:{gap:4,marginBottom:Spacing.two},balanceCard:{borderWidth:1,borderRadius:Radius.large,padding:Spacing.three,gap:Spacing.two},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:Spacing.two},sectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:Spacing.two},segment:{flexDirection:'row',gap:Spacing.two,flexWrap:'wrap'},segmentItem:{flex:1,minWidth:130,borderWidth:1,borderRadius:Radius.medium,padding:Spacing.two,alignItems:'center'},roomBox:{borderWidth:1,borderRadius:Radius.large,padding:Spacing.three,gap:Spacing.two},roomOption:{borderWidth:1,borderRadius:Radius.medium,padding:Spacing.two,flexDirection:'row',justifyContent:'space-between',gap:Spacing.two},product:{borderWidth:1,borderRadius:Radius.large,padding:Spacing.three,gap:Spacing.two},primaryButton:{minHeight:44,borderRadius:Radius.medium,alignItems:'center',justifyContent:'center',paddingHorizontal:Spacing.three},secondaryButton:{minHeight:42,borderWidth:1,borderRadius:Radius.medium,alignItems:'center',justifyContent:'center',paddingHorizontal:Spacing.three},trialCard:{borderWidth:1,borderRadius:Radius.large,padding:Spacing.three,gap:Spacing.two},topup:{flex:1,minWidth:150,borderWidth:1,borderRadius:Radius.medium,padding:Spacing.two,gap:4},historyRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:Spacing.two,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:'#E7DED0',gap:Spacing.two},note:{borderWidth:1,borderRadius:Radius.medium,padding:Spacing.three,marginTop:Spacing.two},notice:{borderWidth:1,borderRadius:Radius.medium,padding:Spacing.two},modalOverlay:{flex:1,justifyContent:'center',alignItems:'center',padding:Spacing.three},confirmCard:{width:'100%',maxWidth:480,borderWidth:1,borderRadius:Radius.large,padding:Spacing.four,gap:Spacing.three},modalButton:{flex:1,minHeight:44,borderWidth:1,borderRadius:Radius.medium,justifyContent:'center',alignItems:'center',padding:Spacing.two}});
