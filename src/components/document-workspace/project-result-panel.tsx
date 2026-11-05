import { useState } from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { citationDraft, manuscriptCount, manuscriptFingerprint, manuscriptText, restoreVersion, snapshot } from '@/lib/document-workspace';
import { workspaceExportText } from '@/lib/workspace-export';
import type { ProjectSettings } from '@/lib/topic-workspace';
import { saveFile } from '@/utils/export/saveFile';
import { workspacePdf } from '@/utils/export/workspacePdf';
import { WorkspaceButton as Button, WorkspaceField as Field, workspaceStyles as s, useWorkspaceConfirm } from './controls';
import type { WorkspaceController } from './types';
import { MarkdownPreview } from './markdown-preview';

export function ProjectResultPanel({ workspace: w, report, settings, topicUpdatedAt, onEdit, onResources }: { workspace: WorkspaceController; report: boolean; settings: ProjectSettings; topicUpdatedAt: string; onEdit: () => void; onResources: () => void }) {
  const confirmWorkspaceAction = useWorkspaceConfirm();
  const [selectedVersion, setSelectedVersion] = useState(''), [error, setError] = useState(''), [exportBusy, setExportBusy] = useState(false);
  const count = manuscriptCount(w.data), version = w.data.versions.find(v => v.id === selectedVersion);
  const stale = w.data.finalFingerprint !== manuscriptFingerprint(w.data) || w.data.finalTopicUpdatedAt !== topicUpdatedAt;
  const unused = w.data.outline.filter(i => !i.body.trim());
  const missingSources = w.data.resources.filter(r => r.used && citationDraft(r, settings.citationStyle).missing.length);
  async function exportDocument(format: 'txt' | 'docx' | 'pdf') {
    const text = workspaceExportText(w.data, settings, report), title = w.data.title || '과제 결과물';
    setExportBusy(true); setError('');
    try {
      if (format === 'pdf') await workspacePdf(text, title);
      else if (format === 'txt') await saveFile(text, `${title}.txt`, 'text/plain;charset=utf-8');
      else { const { workspaceDocx } = await import('@/utils/export/workspaceDocx'); await saveFile(await workspaceDocx(text), `${title}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); }
    } catch (e) { setError((e as Error).message); }
    finally { setExportBusy(false); }
  }
  return <View style={s.group}>
    <ThemedText type="sectionTitle">{report ? '검토·제출' : '최종 결과물'}</ThemedText>
    <Field label="최종 제목" value={w.data.title} onChangeText={title => w.update(v => ({ ...v, title }))} />
    <Field label="부제" value={w.data.subtitle} onChangeText={subtitle => w.update(v => ({ ...v, subtitle }))} />
    <ThemedText type="small">{count}자 · {settings.targetLength ? settings.lengthUnit === 'pages' ? `목표 ${settings.targetLength}페이지 · PDF 인쇄 화면에서 확인 필요` : `목표 ${settings.targetLength}자 · ${count >= settings.targetLength ? '목표 달성' : `${settings.targetLength - count}자 남음`}` : '목표 분량 미설정'}</ThemedText>
    <ThemedText type="small">{w.data.finalVersionId ? stale ? '최종본 이후 내용이 변경되었습니다. 검토 후 최종본을 다시 확정하세요.' : '현재 원고가 최종 확정본입니다.' : '현재 원고는 초안입니다. 검토 후 최종본으로 확정하세요.'}</ThemedText>
    <View style={s.row}><Button onPress={onEdit}>본문 수정으로 이동</Button><Button disabled={!count} onPress={() => { w.update(v => { const final = snapshot(v, '최종 확정 원고'); return { ...v, versions: [...v.versions, final], finalVersionId: final.id, finalFingerprint: manuscriptFingerprint(v), finalTopicUpdatedAt: topicUpdatedAt }; }); void w.save(); }}>최종본 저장·확정</Button></View>
    <ThemedText type="smallBold">제출 전 검토</ThemedText>
    <View style={s.row}>{(report ? ['과제 조건·필수 내용', '목차·문단 흐름', '인용·참고문헌 연결', '맞춤법·표현'] : ['필수 작성 조건', '장면·개요 구성', '분량', '맞춤법·표현']).map(label => <Button key={label} selected={w.data.reviewChecks[label]} onPress={() => w.update(v => ({ ...v, reviewChecks: { ...v.reviewChecks, [label]: !v.reviewChecks[label] } }))}>{`${label} · ${w.data.reviewChecks[label] ? '직접 확인 완료' : '확인 필요'}`}</Button>)}</View>
    <ThemedText type="small">과제 조건: {settings.requirements || '별도 조건 없음'}{settings.requiredElements ? `\n필수 요소: ${settings.requiredElements}` : ''}</ThemedText>
    <ThemedText type="small">목차별 본문: {unused.length ? `${unused.length}개 항목 확인 필요` : '빈 목차 없음'}</ThemedText>
    {unused.map(i => <Button key={i.id} onPress={onEdit}>{`${i.title || '제목 없는 항목'} 작성하러 가기`}</Button>)}
    {report ? <><ThemedText type="small">출처 정보: {missingSources.length ? `${missingSources.length}개 수정 권장` : '등록된 사용 자료의 필수 정보 누락 없음'}</ThemedText>
      <ThemedText type="small">확인되지 않은 자료: {w.data.resources.filter(r => !r.verified).length}개 · 출처가 없는 근거: {w.data.evidence.filter(e => !w.data.resources.some(r => r.id === e.resourceId)).length}개</ThemedText>
      <Button onPress={onResources}>출처·자료 확인하기</Button>
      <ThemedText type="smallBold">참고문헌 서식 초안</ThemedText>
      {settings.citationStyle === '직접 설정' ? <ThemedText type="small">사용자 작성 규칙: {settings.customCitation} · 아래 초안을 직접 맞춰 주세요.</ThemedText> : null}
      {w.data.resources.filter(r => r.used || w.data.outline.some(i => i.resourceIds.includes(r.id))).map((r, index) => <ThemedText key={r.id} selectable type="small">{citationDraft(r, settings.citationStyle, index + 1).text}</ThemedText>)}
    </> : null}
    <ThemedText type="small" themeColor="textSecondary">표현·맞춤법은 AI 피드백 또는 직접 검토로 확인하세요. 사실 정확도·표절 여부는 검사하지 않았습니다.</ThemedText>
    <ThemedText type="smallBold">전체 결과물 미리보기</ThemedText><MarkdownPreview text={workspaceExportText(w.data, settings, report)} />
    <View style={s.row}>{(['txt', 'pdf', 'docx'] as const).map(format => <Button key={format} disabled={exportBusy || !count} onPress={() => void exportDocument(format)}>{`현재 원고 ${format.toUpperCase()} ${format === 'pdf' ? '인쇄·저장' : '내려받기'}`}</Button>)}</View>
    <ThemedText type="smallBold">원고 버전 비교·복원</ThemedText>
    <View style={s.row}>{w.data.versions.map((v, index) => <Button key={v.id} selected={selectedVersion === v.id} onPress={() => setSelectedVersion(v.id)}>{`${index + 1}. ${v.label} · ${new Date(v.createdAt).toLocaleString('ko-KR')}`}</Button>)}</View>
    {version ? <View style={s.item}><ThemedText type="smallBold">선택한 이전 버전</ThemedText><ThemedText selectable>{manuscriptText(version)}</ThemedText><ThemedText type="smallBold">현재 원고</ThemedText><ThemedText selectable>{manuscriptText(w.data)}</ThemedText><Button onPress={() => confirmWorkspaceAction('이 버전으로 복원할까요? 현재 원고는 복원 직전 버전으로 저장됩니다.', () => { w.update(v => restoreVersion(v, version)); void w.save(); })}>이 버전으로 복원</Button></View> : null}
    {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
  </View>;
}
