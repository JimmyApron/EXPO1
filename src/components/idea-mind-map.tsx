import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  applyIdeaFieldDraft,
  getIdeaFieldDraftValue,
  getIdeaFieldLabel,
  getMindMapNodeIdeaField,
  ideaFieldDefinitions,
  isListIdeaField,
  parseIdeaFieldLines,
  validateMindMapIdeaField,
} from '@/lib/mind-map';
import { IdeaStatusLabels, normalizeIdeaCategory, normalizeIdeaStatus, type Idea, type IdeaInput } from '@/types/idea';
import type { IdeaField, MindMap, MindMapIdeaDetailsInput, MindMapNode } from '@/types/mind-map';

type MutationResult = Promise<{ error?: string }>;

type IdeaMindMapProps = {
  mindMap: MindMap | null;
  nodes: MindMapNode[];
  ideas: Idea[];
  isBusy?: boolean;
  isLoading?: boolean;
  highlightedIdeaIds?: Set<string>;
  onCreateDefault: () => MutationResult;
  onUpdateTopic: (title: string) => MutationResult;
  onUpdateIdea: (ideaId: string, input: IdeaInput) => MutationResult;
  onReorganize: () => MutationResult;
  onMoveNode: (nodeId: string, branchId: string) => MutationResult;
  onCreateChild: (node: MindMapNode, input: MindMapIdeaDetailsInput) => MutationResult;
  onUpdateBranch: (nodeId: string, title: string, summary: string) => MutationResult;
  onDeleteBranch: (nodeId: string) => MutationResult;
  onDeleteIdea: (ideaId: string) => MutationResult;
};

const nodeWidth = 220;
const nodeHeight = 104;
const mapPadding = 100;
const minMapZoom = 0.6;
const maxMapZoom = 1.6;
const mapZoomStep = 0.1;

type IdeaDetailsDraft = {
  title: string;
  summary: string;
  problem: string;
  targetusers: string;
  solution: string;
  corefeatures: string;
  keywords: string;
};

function emptyIdeaDetailsDraft(): IdeaDetailsDraft {
  return { title: '', summary: '', problem: '', targetusers: '', solution: '', corefeatures: '', keywords: '' };
}

function getBounds(nodes: MindMapNode[]) {
  if (nodes.length === 0) return { width: 920, height: 620, originX: 100, originY: 310 };
  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y));
  return {
    width: Math.max(920, maxX - minX + nodeWidth + mapPadding * 2),
    height: Math.max(620, maxY - minY + nodeHeight + mapPadding * 2),
    originX: mapPadding + nodeWidth / 2 - minX,
    originY: mapPadding + nodeHeight / 2 - minY,
  };
}

function ideaDetailsDraftToInput(draft: IdeaDetailsDraft): MindMapIdeaDetailsInput {
  return {
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    problem: draft.problem.trim(),
    targetusers: parseIdeaFieldLines(draft.targetusers),
    solution: draft.solution.trim(),
    corefeatures: parseIdeaFieldLines(draft.corefeatures),
    keywords: parseIdeaFieldLines(draft.keywords),
  };
}

function DetailField({ label, value, multiline = true, onChangeText }: { label: string; value: string; multiline?: boolean; onChangeText: (value: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={`${label} 입력`}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, multiline && styles.multilineInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
      />
    </View>
  );
}

function AdvancedIdeaFields({
  draft,
  expanded,
  onToggle,
  onChange,
  excludedField,
  includeSummary = false,
  title = '추가 정보',
  description = '문제 · 대상 사용자 · 해결 방법 · 핵심 기능 · 키워드',
}: {
  draft: IdeaDetailsDraft;
  expanded: boolean;
  onToggle: () => void;
  onChange: (field: keyof IdeaDetailsDraft, value: string) => void;
  excludedField?: IdeaField | null;
  includeSummary?: boolean;
  title?: string;
  description?: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.advancedSection, { borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title} ${expanded ? '접기' : '펼치기'}`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [styles.advancedToggle, pressed && styles.pressed]}>
        <View style={styles.advancedToggleCopy}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">{description}</ThemedText>
        </View>
        <ThemedText type="button" style={{ color: theme.primary }}>{expanded ? '접기' : '펼치기'}</ThemedText>
      </Pressable>
      {expanded ? (
        <View style={[styles.advancedFields, { borderTopColor: theme.divider }]}>
          {includeSummary ? <DetailField label="요약" value={draft.summary} onChangeText={(value) => onChange('summary', value)} /> : null}
          <StructuredIdeaFields draft={draft} excludedField={excludedField} onChange={onChange} />
        </View>
      ) : null}
    </View>
  );
}

function StructuredIdeaFields({
  draft,
  excludedField,
  onChange,
}: {
  draft: IdeaDetailsDraft;
  excludedField?: IdeaField | null;
  onChange: (field: keyof IdeaDetailsDraft, value: string) => void;
}) {
  return ideaFieldDefinitions
    .filter((definition) => definition.field !== excludedField)
    .map((definition) => (
      <DetailField
        key={definition.field}
        label={`${getIdeaFieldLabel(definition.field)}${isListIdeaField(definition.field) ? ' (한 줄에 하나씩)' : ''}`}
        value={draft[definition.field]}
        onChangeText={(value) => onChange(definition.field, value)}
      />
    ));
}

export function IdeaMindMap({
  mindMap,
  nodes,
  ideas,
  isBusy = false,
  isLoading = false,
  highlightedIdeaIds,
  onCreateDefault,
  onUpdateTopic,
  onUpdateIdea,
  onReorganize,
  onMoveNode,
  onCreateChild,
  onUpdateBranch,
  onDeleteBranch,
  onDeleteIdea,
}: IdeaMindMapProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [topicDraft, setTopicDraft] = useState('');
  const [branchSummaryDraft, setBranchSummaryDraft] = useState('');
  const [form, setForm] = useState<IdeaDetailsDraft>(emptyIdeaDetailsDraft);
  const [isFullIdeaEditorOpen, setIsFullIdeaEditorOpen] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [mapZoom, setMapZoom] = useState(1);
  const [addTargetNodeId, setAddTargetNodeId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<IdeaDetailsDraft>(emptyIdeaDetailsDraft);
  const [isAddAdvancedOpen, setIsAddAdvancedOpen] = useState(false);
  const [addError, setAddError] = useState('');
  const [isAddingNode, setIsAddingNode] = useState(false);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const ideaById = useMemo(() => new Map(ideas.map((idea) => [idea.id, idea])), [ideas]);
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null;
  const selectedIdea = selectedNode?.ideaid ? ideaById.get(selectedNode.ideaid) ?? null : null;
  const addTargetNode = addTargetNodeId ? nodeById.get(addTargetNodeId) ?? null : null;
  const addIdeaField = addTargetNode ? getMindMapNodeIdeaField(addTargetNode, nodes) : null;
  const selectedIdeaField = selectedNode?.nodetype === 'idea_field' ? selectedNode.ideafield : null;
  const branches = useMemo(() => nodes.filter((node) => node.nodetype === 'branch'), [nodes]);
  const customBranches = useMemo(() => branches.filter((branch) => !branch.branchfield), [branches]);
  const bounds = useMemo(() => getBounds(nodes), [nodes]);
  const scaledMapWidth = bounds.width * mapZoom;
  const scaledMapHeight = bounds.height * mapZoom;
  const mapZoomPercent = Math.round(mapZoom * 100);
  const canZoomOut = mapZoom > minMapZoom;
  const canZoomIn = mapZoom < maxMapZoom;

  const updateMapZoom = (delta: number) => {
    setMapZoom((current) => Math.min(maxMapZoom, Math.max(minMapZoom, Math.round((current + delta) * 10) / 10)));
  };

  const openNode = (node: MindMapNode) => {
    const idea = node.ideaid ? ideaById.get(node.ideaid) ?? null : null;
    setTopicDraft(node.title);
    setBranchSummaryDraft(node.summary);
    if (idea) {
      setForm({
        title: idea.title,
        summary: idea.summary,
        problem: idea.problem,
        targetusers: getIdeaFieldDraftValue(idea, 'targetusers'),
        solution: idea.solution,
        corefeatures: getIdeaFieldDraftValue(idea, 'corefeatures'),
        keywords: getIdeaFieldDraftValue(idea, 'keywords'),
      });
    }
    setLocalError('');
    setIsFullIdeaEditorOpen(node.nodetype === 'idea');
    setSelectedNodeId(node.id);
  };

  const saveDetails = async () => {
    if (!selectedNode) return;
    setIsSaving(true);
    setLocalError('');
    let result: { error?: string };
    if (selectedNode.nodetype === 'root') {
      result = await onUpdateTopic(topicDraft);
    } else if (selectedNode.nodetype === 'branch' && !selectedNode.branchfield) {
      result = await onUpdateBranch(selectedNode.id, topicDraft, branchSummaryDraft);
    } else if (selectedIdea) {
      const details = ideaDetailsDraftToInput(form);
      if (selectedIdeaField) {
        const validationError = validateMindMapIdeaField(details, selectedIdeaField);
        if (validationError) {
          setIsSaving(false);
          setLocalError(validationError);
          return;
        }
      }
      result = await onUpdateIdea(selectedIdea.id, {
        title: details.title,
        content: selectedIdea.content || details.summary || details.problem || details.solution || details.title,
        status: normalizeIdeaStatus(selectedIdea.status),
        category: normalizeIdeaCategory(selectedIdea.category),
        sourceid: selectedIdea.sourceid,
        summary: details.summary,
        problem: details.problem,
        targetusers: details.targetusers,
        solution: details.solution,
        corefeatures: details.corefeatures,
        keywords: details.keywords,
      });
    } else {
      result = {};
    }
    setIsSaving(false);
    if (result.error) setLocalError(result.error);
    else setSelectedNodeId(null);
  };

  const deleteSelectedBranch = () => {
    if (!selectedNode || selectedNode.nodetype !== 'branch') return;
    const message = `'${selectedNode.title}' 가지를 삭제할까요? 실제 아이디어는 목록에 그대로 남고 마인드맵 배치만 해제됩니다.`;
    const runDelete = async () => {
      setIsSaving(true);
      setLocalError('');
      const result = await onDeleteBranch(selectedNode.id);
      setIsSaving(false);
      if (result.error) setLocalError(result.error);
      else setSelectedNodeId(null);
    };

    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(message)) void runDelete();
      return;
    }
    Alert.alert('분류 가지 삭제', message, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => void runDelete() },
    ]);
  };

  const deleteSelectedIdea = () => {
    if (!selectedIdea) return;
    const message = `'${selectedIdea.title}' 아이디어를 삭제할까요? 마인드맵과 아이디어 목록에서 모두 삭제되며 되돌릴 수 없습니다.`;
    const runDelete = async () => {
      setIsSaving(true);
      setLocalError('');
      const result = await onDeleteIdea(selectedIdea.id);
      setIsSaving(false);
      if (result.error) setLocalError(result.error);
      else setSelectedNodeId(null);
    };

    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(message)) void runDelete();
      return;
    }
    Alert.alert('아이디어 삭제', message, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => void runDelete() },
    ]);
  };

  const submitNewNode = async () => {
    if (!addTargetNode) return;
    if (!addForm.title.trim()) {
      setAddError(addTargetNode.nodetype === 'root' ? '분류 이름을 입력해 주세요.' : '아이디어 제목을 입력해 주세요.');
      return;
    }
    let input = ideaDetailsDraftToInput(addForm);
    if (addIdeaField) {
      input = applyIdeaFieldDraft(input, addIdeaField, addForm[addIdeaField]);
      const validationError = validateMindMapIdeaField(input, addIdeaField);
      if (validationError) {
        setAddError(validationError);
        return;
      }
    }
    setIsAddingNode(true);
    setAddError('');
    const result = await onCreateChild(addTargetNode, input);
    setIsAddingNode(false);
    if (result.error) setAddError(result.error);
    else {
      setAddTargetNodeId(null);
      setAddForm(emptyIdeaDetailsDraft());
      setIsAddAdvancedOpen(false);
    }
  };

  if (isLoading) {
    return <ThemedView type="backgroundElement" style={styles.empty}><ActivityIndicator /></ThemedView>;
  }

  if (!mindMap || nodes.length === 0) {
    return (
      <ThemedView type="backgroundElement" style={[styles.empty, { borderColor: theme.border }]}>
        <ThemedText type="sectionTitle">프로젝트 마인드맵을 시작해 보세요</ThemedText>
        <ThemedText themeColor="textSecondary">과제명이 중심 주제가 되고, 아이디어는 의미 있는 가지 아래에 배치됩니다.</ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel="기본 마인드맵 만들기" disabled={isBusy} onPress={() => void onCreateDefault()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.primary }, (pressed || isBusy) && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.whiteText}>기본 마인드맵 만들기</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarCopy}>
          <ThemedText type="subtitle">{mindMap.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">노드를 선택하면 전체 내용을 보고 수정할 수 있습니다.</ThemedText>
        </View>
        <View style={styles.toolbarActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="마인드맵 재정렬" disabled={isBusy} onPress={() => void onReorganize()} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.border }, (pressed || isBusy) && styles.pressed]}><ThemedText type="smallBold">재정렬</ThemedText></Pressable>
        </View>
      </View>

      <View style={styles.mapFrame}>
        <ScrollView horizontal style={[styles.viewport, { borderColor: theme.border, backgroundColor: theme.background }]} contentContainerStyle={{ minWidth: scaledMapWidth }}>
          <ScrollView nestedScrollEnabled contentContainerStyle={{ width: scaledMapWidth, height: scaledMapHeight }}>
            <View style={{ width: scaledMapWidth, height: scaledMapHeight, overflow: 'hidden' }}>
              <View style={{ width: bounds.width, height: bounds.height, transform: [{ scale: mapZoom }], transformOrigin: 'top left' }}>
            <Svg width={bounds.width} height={bounds.height} style={StyleSheet.absoluteFill}>
              {nodes.map((node) => {
                const parent = node.parentnodeid ? nodeById.get(node.parentnodeid) : null;
                if (!parent) return null;
                return <Line key={`${parent.id}-${node.id}`} x1={bounds.originX + parent.x} y1={bounds.originY + parent.y} x2={bounds.originX + node.x} y2={bounds.originY + node.y} stroke={theme.textTertiary} strokeWidth={2} />;
              })}
            </Svg>
            {nodes.map((node) => {
              const idea = node.ideaid ? ideaById.get(node.ideaid) : null;
              const displayTitle = idea?.title || node.title;
              const nodeLabel = node.nodetype === 'idea_field' && node.ideafield
                ? getIdeaFieldLabel(node.ideafield)
                : node.nodetype === 'root'
                  ? '중심 주제'
                  : node.nodetype === 'branch'
                    ? node.branchfield ? '고정 필드' : '사용자 분류'
                    : IdeaStatusLabels[normalizeIdeaStatus(idea?.status)];
              const isHighlighted = Boolean(node.ideaid && highlightedIdeaIds?.has(node.ideaid));
              const palette = node.nodetype === 'root'
                ? { backgroundColor: theme.primary, borderColor: theme.primary, text: '#ffffff' }
                : node.nodetype === 'branch'
                  ? { backgroundColor: theme.primarySoft, borderColor: theme.primary, text: theme.primary }
                  : { backgroundColor: theme.surface, borderColor: isHighlighted ? theme.success : theme.border, text: theme.text };
              return (
                <View key={node.id} style={[styles.nodeWrap, { left: bounds.originX + node.x - nodeWidth / 2, top: bounds.originY + node.y - nodeHeight / 2 }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${node.nodetype === 'root' ? '중심 주제' : node.nodetype === 'branch' ? '분류 가지' : '아이디어'} ${displayTitle} 상세 보기`}
                    onPress={() => openNode(node)}
                    style={({ pressed }) => [styles.node, { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }, isHighlighted && styles.highlightedNode, pressed && styles.pressed, Shadows.card]}>
                    <ThemedText type="captionStrong" style={{ color: palette.text }}>{nodeLabel}</ThemedText>
                    <ThemedText type="smallBold" numberOfLines={2} style={{ color: palette.text }}>{displayTitle}</ThemedText>
                    <ThemedText type="caption" numberOfLines={2} style={{ color: node.nodetype === 'root' ? '#EEF0FF' : theme.textSecondary }}>{node.nodetype === 'idea_field' ? node.summary : idea?.summary || node.summary}</ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${displayTitle}에 ${node.nodetype === 'root' ? '새 분류 가지' : '새 아이디어'} 추가`}
                    disabled={isBusy}
                    onPress={() => {
                      setAddTargetNodeId(node.id);
                      setAddForm(emptyIdeaDetailsDraft());
                      setIsAddAdvancedOpen(false);
                      setAddError('');
                    }}
                    style={({ pressed }) => [styles.addNodeButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.primary }, Shadows.card, (pressed || isBusy) && styles.pressed]}>
                    <ThemedText type="button" style={{ color: theme.primary }}>+</ThemedText>
                  </Pressable>
                </View>
              );
            })}
              </View>
            </View>
          </ScrollView>
        </ScrollView>
        <View style={[styles.zoomControls, styles.fixedZoomControls, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }, Shadows.card]} accessibilityLabel={`마인드맵 확대 배율 ${mapZoomPercent}%`}>
          <Pressable accessibilityRole="button" accessibilityLabel="마인드맵 축소" accessibilityState={{ disabled: !canZoomOut }} disabled={!canZoomOut} onPress={() => updateMapZoom(-mapZoomStep)} style={({ pressed }) => [styles.zoomButton, { borderColor: theme.border }, (!canZoomOut || pressed) && styles.pressed]}><ThemedText type="button">−</ThemedText></Pressable>
          <View style={[styles.zoomBadge, { borderColor: theme.border, backgroundColor: theme.surface }]}><ThemedText type="smallBold">{mapZoomPercent}%</ThemedText></View>
          <Pressable accessibilityRole="button" accessibilityLabel="마인드맵 확대" accessibilityState={{ disabled: !canZoomIn }} disabled={!canZoomIn} onPress={() => updateMapZoom(mapZoomStep)} style={({ pressed }) => [styles.zoomButton, { borderColor: theme.border }, (!canZoomIn || pressed) && styles.pressed]}><ThemedText type="button">+</ThemedText></Pressable>
        </View>
      </View>

      <Modal visible={Boolean(addTargetNode)} transparent animationType="fade" onRequestClose={() => setAddTargetNodeId(null)}>
        <View accessibilityViewIsModal style={[styles.overlay, { backgroundColor: theme.overlay }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="노드 추가 취소" onPress={() => setAddTargetNodeId(null)} style={StyleSheet.absoluteFill} />
          <ThemedView type="surfaceElevated" style={[styles.addNodePanel, { borderColor: theme.border }, Shadows.floating]}>
            <ScrollView contentContainerStyle={styles.addNodeContent} keyboardShouldPersistTaps="handled">
              <View style={styles.addNodeCopy}>
                <ThemedText type="sectionTitle">{addTargetNode?.nodetype === 'root' ? '새 분류 가지' : '새 아이디어'}</ThemedText>
                <ThemedText themeColor="textSecondary">
                  {addTargetNode?.nodetype === 'root'
                    ? `${addTargetNode.title} 아래에 새 주제 가지를 추가합니다.`
                    : `${addTargetNode?.nodetype === 'branch' ? addTargetNode.title : nodeById.get(addTargetNode?.parentnodeid ?? '')?.title ?? '선택한 가지'} 아래에 아이디어를 추가합니다.`}
                </ThemedText>
              </View>
              <DetailField label={addTargetNode?.nodetype === 'root' ? '분류 이름' : '아이디어 제목'} value={addForm.title} multiline={false} onChangeText={(value) => { setAddForm((current) => ({ ...current, title: value })); if (addError) setAddError(''); }} />
              {addTargetNode?.nodetype === 'root' ? (
                <DetailField label="분류 설명" value={addForm.summary} onChangeText={(value) => setAddForm((current) => ({ ...current, summary: value }))} />
              ) : addIdeaField ? (
                <>
                  <DetailField
                    label={`${getIdeaFieldLabel(addIdeaField)}${isListIdeaField(addIdeaField) ? ' (한 줄에 하나씩)' : ''}`}
                    value={addForm[addIdeaField]}
                    onChangeText={(value) => {
                      setAddForm((current) => ({ ...current, [addIdeaField]: value }));
                      if (addError) setAddError('');
                    }}
                  />
                  <AdvancedIdeaFields
                    draft={addForm}
                    expanded={isAddAdvancedOpen}
                    excludedField={addIdeaField}
                    includeSummary
                    title="전체 아이디어 작성하기"
                    description="요약과 나머지 구조화 필드를 함께 작성할 수 있습니다."
                    onToggle={() => setIsAddAdvancedOpen((current) => !current)}
                    onChange={(field, value) => setAddForm((current) => ({ ...current, [field]: value }))}
                  />
                </>
              ) : (
                <>
                  <DetailField label="요약" value={addForm.summary} onChangeText={(value) => setAddForm((current) => ({ ...current, summary: value }))} />
                <AdvancedIdeaFields
                  draft={addForm}
                  expanded={isAddAdvancedOpen}
                  onToggle={() => setIsAddAdvancedOpen((current) => !current)}
                  onChange={(field, value) => setAddForm((current) => ({ ...current, [field]: value }))}
                />
                </>
              )}
              {addError ? <ThemedText accessibilityRole="alert" style={{ color: theme.danger }}>{addError}</ThemedText> : null}
              <View style={styles.addNodeActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="노드 추가 취소" disabled={isAddingNode} onPress={() => setAddTargetNodeId(null)} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.border }, (pressed || isAddingNode) && styles.pressed]}><ThemedText type="smallBold">취소</ThemedText></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={addTargetNode?.nodetype === 'root' ? '분류 가지 추가' : '아이디어 추가'} disabled={isAddingNode} onPress={() => void submitNewNode()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.primary }, (pressed || isAddingNode) && styles.pressed]}>{isAddingNode ? <ActivityIndicator color="#ffffff" /> : <ThemedText type="smallBold" style={styles.whiteText}>추가</ThemedText>}</Pressable>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedNode)} transparent animationType={width < 700 ? 'slide' : 'fade'} onRequestClose={() => setSelectedNodeId(null)}>
        <View accessibilityViewIsModal style={[styles.overlay, { backgroundColor: theme.overlay }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="마인드맵 상세 닫기"
            onPress={() => setSelectedNodeId(null)}
            style={StyleSheet.absoluteFill}
          />
          <ThemedView type="surfaceElevated" style={[styles.detailPanel, width < 700 && styles.mobileDetailPanel, { borderColor: theme.border }, Shadows.floating]}>
            <ScrollView contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled">
              <View style={styles.detailHeader}>
                <View><ThemedText type="sectionTitle">{selectedNode?.nodetype === 'root' ? '중심 주제 편집' : selectedNode?.nodetype === 'branch' ? '분류 가지' : '아이디어 상세'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{selectedNode?.title}</ThemedText></View>
                <Pressable accessibilityRole="button" accessibilityLabel="상세 닫기" onPress={() => setSelectedNodeId(null)} style={styles.closeButton}><ThemedText type="button">닫기</ThemedText></Pressable>
              </View>
              {selectedNode?.nodetype === 'root' ? <DetailField label="중심 주제" value={topicDraft} multiline={false} onChangeText={setTopicDraft} /> : null}
              {selectedNode?.nodetype === 'branch' && !selectedNode.branchfield ? (
                <>
                  <DetailField label="분류 이름" value={topicDraft} multiline={false} onChangeText={setTopicDraft} />
                  <DetailField label="분류 설명" value={branchSummaryDraft} onChangeText={setBranchSummaryDraft} />
                </>
              ) : null}
              {selectedNode?.nodetype === 'branch' && selectedNode.branchfield ? (
                <View style={[styles.fixedBranchNotice, { borderColor: theme.border, backgroundColor: theme.primarySoft }]}>
                  <ThemedText type="smallBold">고정 필드 가지</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">이 가지는 {getIdeaFieldLabel(selectedNode.branchfield)} 필드 전용이며 이름을 바꾸거나 삭제할 수 없습니다.</ThemedText>
                </View>
              ) : null}
              {selectedIdea ? (
                <>
                  {selectedIdeaField ? (
                    <DetailField
                      label={`${getIdeaFieldLabel(selectedIdeaField)}${isListIdeaField(selectedIdeaField) ? ' (한 줄에 하나씩)' : ''}`}
                      value={form[selectedIdeaField]}
                      onChangeText={(value) => {
                        setForm((current) => ({ ...current, [selectedIdeaField]: value }));
                        if (localError) setLocalError('');
                      }}
                    />
                  ) : null}
                  {selectedNode?.nodetype === 'idea_field' ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="원본 아이디어 전체 편집" accessibilityState={{ expanded: isFullIdeaEditorOpen }} onPress={() => setIsFullIdeaEditorOpen((current) => !current)} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.border }, pressed && styles.pressed]}>
                      <ThemedText type="smallBold">{isFullIdeaEditorOpen ? '전체 편집 닫기' : '원본 아이디어 전체 편집'}</ThemedText>
                    </Pressable>
                  ) : null}
                  {isFullIdeaEditorOpen ? (
                    <>
                      <DetailField label="제목" value={form.title} multiline={false} onChangeText={(value) => setForm((current) => ({ ...current, title: value }))} />
                      <DetailField label="요약" value={form.summary} onChangeText={(value) => setForm((current) => ({ ...current, summary: value }))} />
                      <StructuredIdeaFields
                        draft={form}
                        excludedField={selectedIdeaField}
                        onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
                      />
                      {selectedNode?.nodetype === 'idea' && customBranches.length > 0 ? <View style={styles.field}><ThemedText type="smallBold">다른 사용자 정의 가지로 이동</ThemedText><View style={styles.branchChoices}>{customBranches.map((branch) => <Pressable key={branch.id} accessibilityRole="button" accessibilityLabel={`${branch.title} 가지로 이동`} accessibilityState={{ selected: selectedNode?.parentnodeid === branch.id }} disabled={selectedNode?.parentnodeid === branch.id} onPress={() => selectedNode ? void onMoveNode(selectedNode.id, branch.id) : undefined} style={({ pressed }) => [styles.branchChoice, { borderColor: theme.border }, selectedNode?.parentnodeid === branch.id && { backgroundColor: theme.primarySoft }, pressed && styles.pressed]}><ThemedText type="smallBold">{branch.title}</ThemedText></Pressable>)}</View></View> : null}
                    </>
                  ) : null}
                </>
              ) : null}
              {selectedNode?.nodetype === 'branch' && !selectedNode.branchfield ? <ThemedText type="small" themeColor="textSecondary">가지를 삭제해도 실제 아이디어는 목록에 보존됩니다.</ThemedText> : null}
              {localError ? <ThemedText accessibilityRole="alert" style={{ color: theme.danger }}>{localError}</ThemedText> : null}
              <View style={styles.detailActions}>
                {selectedNode?.nodetype === 'branch' && !selectedNode.branchfield ? <Pressable accessibilityRole="button" accessibilityLabel="분류 가지 삭제" disabled={isSaving} onPress={deleteSelectedBranch} style={({ pressed }) => [styles.dangerButton, { borderColor: theme.danger }, (pressed || isSaving) && styles.pressed]}><ThemedText type="smallBold" style={{ color: theme.danger }}>삭제</ThemedText></Pressable> : null}
                {selectedIdea ? <Pressable accessibilityRole="button" accessibilityLabel={`${selectedIdea.title} 아이디어 삭제`} disabled={isSaving} onPress={deleteSelectedIdea} style={({ pressed }) => [styles.dangerButton, { borderColor: theme.danger }, (pressed || isSaving) && styles.pressed]}><ThemedText type="smallBold" style={{ color: theme.danger }}>아이디어 삭제</ThemedText></Pressable> : null}
                {selectedNode?.nodetype === 'root' || (selectedNode?.nodetype === 'branch' && !selectedNode.branchfield) || (selectedIdea && (isFullIdeaEditorOpen || selectedIdeaField)) ? <Pressable accessibilityRole="button" accessibilityLabel="상세 내용 저장" disabled={isSaving} onPress={() => void saveDetails()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.primary }, (pressed || isSaving) && styles.pressed]}>{isSaving ? <ActivityIndicator color="#ffffff" /> : <ThemedText type="smallBold" style={styles.whiteText}>저장</ThemedText>}</Pressable> : null}
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  toolbarCopy: { flex: 1, minWidth: 240, gap: Spacing.half },
  toolbarActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  mapFrame: { position: 'relative' },
  zoomControls: { minHeight: ControlHeight.touch, flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  fixedZoomControls: { position: 'absolute', zIndex: 10, elevation: 10, top: Spacing.three, right: Spacing.three, borderWidth: 1, borderRadius: Radius.large, padding: Spacing.one },
  zoomButton: { width: ControlHeight.touch, height: ControlHeight.touch, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: Radius.pill },
  zoomBadge: { minWidth: 58, height: ControlHeight.touch, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.one },
  viewport: { width: '100%', height: 640, borderWidth: 1, borderRadius: Radius.large },
  nodeWrap: { position: 'absolute', width: nodeWidth, height: nodeHeight },
  node: { width: nodeWidth, height: nodeHeight, justifyContent: 'center', gap: Spacing.half, borderWidth: 2, borderRadius: Radius.medium, padding: Spacing.two },
  addNodeButton: { position: 'absolute', right: -14, top: -14, zIndex: 2, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: 17 },
  highlightedNode: { borderWidth: 3, transform: [{ scale: 1.04 }] },
  empty: { alignItems: 'center', gap: Spacing.three, borderWidth: 1, borderRadius: Radius.large, padding: Spacing.four },
  primaryButton: { minHeight: ControlHeight.button, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  secondaryButton: { minHeight: ControlHeight.touch, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  whiteText: { color: '#ffffff' },
  overlay: { flex: 1, alignItems: 'flex-end', justifyContent: 'center', padding: Spacing.three },
  detailPanel: { width: '100%', maxWidth: 520, maxHeight: '92%', borderWidth: 1, borderRadius: Radius.xlarge },
  addNodePanel: { width: '100%', maxWidth: 520, maxHeight: '90%', borderWidth: 1, borderRadius: Radius.xlarge },
  addNodeContent: { gap: Spacing.three, padding: Spacing.four },
  addNodeCopy: { gap: Spacing.one },
  addNodeActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  mobileDetailPanel: { maxWidth: undefined, maxHeight: '90%', alignSelf: 'stretch', marginTop: 'auto' },
  detailContent: { gap: Spacing.three, padding: Spacing.four },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.two },
  detailActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  dangerButton: { minHeight: ControlHeight.button, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  closeButton: { minHeight: ControlHeight.touch, justifyContent: 'center', paddingHorizontal: Spacing.two },
  field: { gap: Spacing.one },
  fixedBranchNotice: { gap: Spacing.one, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  advancedSection: { overflow: 'hidden', borderWidth: 1, borderRadius: Radius.medium },
  advancedToggle: { minHeight: ControlHeight.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  advancedToggleCopy: { flex: 1, gap: Spacing.half },
  advancedFields: { gap: Spacing.three, borderTopWidth: 1, padding: Spacing.three },
  input: { minHeight: ControlHeight.input, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  multilineInput: { minHeight: 76, textAlignVertical: 'top' },
  branchChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  branchChoice: { minHeight: ControlHeight.touch, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.three },
  pressed: { opacity: Platform.OS === 'web' ? 0.72 : 0.6 },
});
