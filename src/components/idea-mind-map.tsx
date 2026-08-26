import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadows, Spacing } from '@/constants/theme';
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
import {
  IdeaStatusLabels,
  normalizeIdeaCategory,
  normalizeIdeaStatus,
  type Idea,
  type IdeaInput,
} from '@/types/idea';
import type { IdeaField, MindMap, MindMapIdeaDetailsInput, MindMapNode } from '@/types/mind-map';

// 🎨 디자인 가이드 팔레트
const PALETTE = {
  primary: '#F59E0B',        // 메인 옐로우/오렌지
  primaryLight: '#FEF3C7',   // 연노랑 (브랜치 노드, 하이라이트)
  primaryDark: '#D97706',    // 딥 오렌지
  background: '#FAF7F2',     // 마인드맵 캔버스 크림색
  card: '#FFFFFF',           // 아이디어 노드 흰색 카드
  cardBorder: '#F3E8D6',     // 연한 크림 테두리
  inputBg: '#FAF7F2',        // 입력창 배경
  inputBorder: '#E2E8F0',    // 인풋 테두리
  text: '#1E293B',           // 짙은 네이비 본문/제목
  textSecondary: '#64748B',  // 보조 텍스트
  lineStroke: '#CBD5E1',     // 노드 연결선
  success: '#10B981',        // 완료/강조 초록
  danger: '#EF4444',         // 위험/삭제 빨강
  overlay: 'rgba(15, 23, 42, 0.45)', // 모달 배경
};

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

function DetailField({
  label,
  value,
  multiline = true,
  onChangeText,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={`${label} 입력`}
        placeholderTextColor={PALETTE.textSecondary}
        style={[styles.input, multiline && styles.multilineInput]}
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
  return (
    <View style={styles.advancedSection}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title} ${expanded ? '접기' : '펼치기'}`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [styles.advancedToggle, pressed && styles.pressed]}>
        <View style={styles.advancedToggleCopy}>
          <ThemedText style={styles.fieldLabel}>{title}</ThemedText>
          <ThemedText style={styles.advancedDescription}>{description}</ThemedText>
        </View>
        <ThemedText style={styles.advancedToggleBtn}>{expanded ? '접기' : '펼치기'}</ThemedText>
      </Pressable>
      {expanded ? (
        <View style={styles.advancedFields}>
          {includeSummary ? (
            <DetailField label="요약" value={draft.summary} onChangeText={(value) => onChange('summary', value)} />
          ) : null}
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
    return (
      <View style={[styles.empty, { backgroundColor: PALETTE.card, borderColor: PALETTE.cardBorder }]}>
        <ActivityIndicator color={PALETTE.primary} />
      </View>
    );
  }

  if (!mindMap || nodes.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: PALETTE.card, borderColor: PALETTE.cardBorder }]}>
        <ThemedText style={styles.emptyTitle}>💡 프로젝트 마인드맵을 시작해 보세요</ThemedText>
        <ThemedText style={styles.emptySubtitle}>
          과제명이 중심 주제가 되고, 아이디어는 의미 있는 가지 아래에 배치됩니다.
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="기본 마인드맵 만들기"
          disabled={isBusy}
          onPress={() => void onCreateDefault()}
          style={({ pressed }) => [styles.primaryButton, (pressed || isBusy) && styles.pressed]}>
          <ThemedText style={styles.whiteText}>기본 마인드맵 만들기</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 툴바 */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarCopy}>
          <ThemedText style={styles.mapHeaderTitle}>{mindMap.title}</ThemedText>
          <ThemedText style={styles.mapHeaderSub}>노드를 선택하면 전체 내용을 보고 수정할 수 있습니다.</ThemedText>
        </View>
        <View style={styles.toolbarActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="마인드맵 재정렬"
            disabled={isBusy}
            onPress={() => void onReorganize()}
            style={({ pressed }) => [styles.secondaryButton, (pressed || isBusy) && styles.pressed]}>
            <ThemedText style={styles.secondaryButtonText}>재정렬</ThemedText>
          </Pressable>
        </View>
      </View>

      {/* 맵 프레임 */}
      <View style={styles.mapFrame}>
        <ScrollView
          horizontal
          style={styles.viewport}
          contentContainerStyle={{ minWidth: scaledMapWidth }}>
          <ScrollView nestedScrollEnabled contentContainerStyle={{ width: scaledMapWidth, height: scaledMapHeight }}>
            <View style={{ width: scaledMapWidth, height: scaledMapHeight, overflow: 'hidden' }}>
              <View
                style={{
                  width: bounds.width,
                  height: bounds.height,
                  transform: [{ scale: mapZoom }],
                  transformOrigin: 'top left',
                }}>
                <Svg width={bounds.width} height={bounds.height} style={StyleSheet.absoluteFill}>
                  {nodes.map((node) => {
                    const parent = node.parentnodeid ? nodeById.get(node.parentnodeid) : null;
                    if (!parent) return null;
                    return (
                      <Line
                        key={`${parent.id}-${node.id}`}
                        x1={bounds.originX + parent.x}
                        y1={bounds.originY + parent.y}
                        x2={bounds.originX + node.x}
                        y2={bounds.originY + node.y}
                        stroke={PALETTE.lineStroke}
                        strokeWidth={2}
                      />
                    );
                  })}
                </Svg>
                {nodes.map((node) => {
                  const idea = node.ideaid ? ideaById.get(node.ideaid) : null;
                  const displayTitle = idea?.title || node.title;
                  const nodeLabel =
                    node.nodetype === 'idea_field' && node.ideafield
                      ? getIdeaFieldLabel(node.ideafield)
                      : node.nodetype === 'root'
                      ? '중심 주제'
                      : node.nodetype === 'branch'
                      ? node.branchfield
                        ? '고정 필드'
                        : '분류 가지'
                      : IdeaStatusLabels[normalizeIdeaStatus(idea?.status)];
                  const isHighlighted = Boolean(node.ideaid && highlightedIdeaIds?.has(node.ideaid));

                  // 노드별 스타일링
                  const isRoot = node.nodetype === 'root';
                  const isBranch = node.nodetype === 'branch';

                  return (
                    <View
                      key={node.id}
                      style={[
                        styles.nodeWrap,
                        {
                          left: bounds.originX + node.x - nodeWidth / 2,
                          top: bounds.originY + node.y - nodeHeight / 2,
                        },
                      ]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${displayTitle} 상세 보기`}
                        onPress={() => openNode(node)}
                        style={({ pressed }) => [
                          styles.node,
                          isRoot && styles.rootNode,
                          isBranch && styles.branchNode,
                          !isRoot && !isBranch && styles.ideaNode,
                          isHighlighted && styles.highlightedNode,
                          Shadows.card,
                          pressed && styles.pressed,
                        ]}>
                        <ThemedText
                          style={[
                            styles.nodeBadge,
                            isRoot && styles.rootBadge,
                            isBranch && styles.branchBadge,
                          ]}>
                          {nodeLabel}
                        </ThemedText>
                        <ThemedText
                          style={[
                            styles.nodeTitle,
                            isRoot && styles.rootTitle,
                            isBranch && styles.branchTitle,
                          ]}
                          numberOfLines={2}>
                          {displayTitle}
                        </ThemedText>
                        <ThemedText
                          style={[
                            styles.nodeSummary,
                            isRoot && styles.rootSummary,
                          ]}
                          numberOfLines={2}>
                          {node.nodetype === 'idea_field' ? node.summary : idea?.summary || node.summary}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${displayTitle}에 추가`}
                        disabled={isBusy}
                        onPress={() => {
                          setAddTargetNodeId(node.id);
                          setAddForm(emptyIdeaDetailsDraft());
                          setIsAddAdvancedOpen(false);
                          setAddError('');
                        }}
                        style={({ pressed }) => [
                          styles.addNodeButton,
                          Shadows.card,
                          (pressed || isBusy) && styles.pressed,
                        ]}>
                        <ThemedText style={styles.addNodeButtonText}>+</ThemedText>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </ScrollView>

        {/* 줌 컨트롤 */}
        <View
          style={[styles.zoomControls, styles.fixedZoomControls, Shadows.card]}
          accessibilityLabel={`마인드맵 확대 배율 ${mapZoomPercent}%`}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="마인드맵 축소"
            disabled={!canZoomOut}
            onPress={() => updateMapZoom(-mapZoomStep)}
            style={({ pressed }) => [styles.zoomButton, (!canZoomOut || pressed) && styles.pressed]}>
            <ThemedText style={styles.zoomButtonText}>−</ThemedText>
          </Pressable>
          <View style={styles.zoomBadge}>
            <ThemedText style={styles.zoomBadgeText}>{mapZoomPercent}%</ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="마인드맵 확대"
            disabled={!canZoomIn}
            onPress={() => updateMapZoom(mapZoomStep)}
            style={({ pressed }) => [styles.zoomButton, (!canZoomIn || pressed) && styles.pressed]}>
            <ThemedText style={styles.zoomButtonText}>+</ThemedText>
          </Pressable>
        </View>
      </View>

      {/* 노드 추가 모달 */}
      <Modal visible={Boolean(addTargetNode)} transparent animationType="fade" onRequestClose={() => setAddTargetNodeId(null)}>
        <View accessibilityViewIsModal style={styles.overlay}>
          <Pressable accessibilityRole="button" onPress={() => setAddTargetNodeId(null)} style={StyleSheet.absoluteFill} />
          <View style={[styles.addNodePanel, Shadows.floating]}>
            <ScrollView contentContainerStyle={styles.addNodeContent} keyboardShouldPersistTaps="handled">
              <View style={styles.addNodeCopy}>
                <ThemedText style={styles.modalHeadingTitle}>
                  {addTargetNode?.nodetype === 'root' ? '새 분류 가지' : '새 아이디어'}
                </ThemedText>
                <ThemedText style={styles.modalHeadingSub}>
                  {addTargetNode?.nodetype === 'root'
                    ? `${addTargetNode.title} 아래에 새 주제 가지를 추가합니다.`
                    : `${addTargetNode?.nodetype === 'branch' ? addTargetNode.title : nodeById.get(addTargetNode?.parentnodeid ?? '')?.title ?? '선택한 가지'} 아래에 아이디어를 추가합니다.`}
                </ThemedText>
              </View>
              <DetailField
                label={addTargetNode?.nodetype === 'root' ? '분류 이름' : '아이디어 제목'}
                value={addForm.title}
                multiline={false}
                onChangeText={(value) => {
                  setAddForm((current) => ({ ...current, title: value }));
                  if (addError) setAddError('');
                }}
              />
              {addTargetNode?.nodetype === 'root' ? (
                <DetailField
                  label="분류 설명"
                  value={addForm.summary}
                  onChangeText={(value) => setAddForm((current) => ({ ...current, summary: value }))}
                />
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
                  <DetailField
                    label="요약"
                    value={addForm.summary}
                    onChangeText={(value) => setAddForm((current) => ({ ...current, summary: value }))}
                  />
                  <AdvancedIdeaFields
                    draft={addForm}
                    expanded={isAddAdvancedOpen}
                    onToggle={() => setIsAddAdvancedOpen((current) => !current)}
                    onChange={(field, value) => setAddForm((current) => ({ ...current, [field]: value }))}
                  />
                </>
              )}
              {addError ? <ThemedText style={styles.errorAlertText}>{addError}</ThemedText> : null}
              <View style={styles.addNodeActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isAddingNode}
                  onPress={() => setAddTargetNodeId(null)}
                  style={({ pressed }) => [styles.secondaryButton, (pressed || isAddingNode) && styles.pressed]}>
                  <ThemedText style={styles.secondaryButtonText}>취소</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isAddingNode}
                  onPress={() => void submitNewNode()}
                  style={({ pressed }) => [styles.primaryButton, (pressed || isAddingNode) && styles.pressed]}>
                  {isAddingNode ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <ThemedText style={styles.whiteText}>추가</ThemedText>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 노드 상세 및 편집 모달 */}
      <Modal visible={Boolean(selectedNode)} transparent animationType={width < 700 ? 'slide' : 'fade'} onRequestClose={() => setSelectedNodeId(null)}>
        <View accessibilityViewIsModal style={styles.overlay}>
          <Pressable accessibilityRole="button" onPress={() => setSelectedNodeId(null)} style={StyleSheet.absoluteFill} />
          <View style={[styles.detailPanel, width < 700 && styles.mobileDetailPanel, Shadows.floating]}>
            <ScrollView contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled">
              <View style={styles.detailHeader}>
                <View style={{ gap: 2 }}>
                  <ThemedText style={styles.modalHeadingTitle}>
                    {selectedNode?.nodetype === 'root'
                      ? '중심 주제 편집'
                      : selectedNode?.nodetype === 'branch'
                      ? '분류 가지'
                      : '아이디어 상세'}
                  </ThemedText>
                  <ThemedText style={styles.modalHeadingSub}>{selectedNode?.title}</ThemedText>
                </View>
                <Pressable accessibilityRole="button" onPress={() => setSelectedNodeId(null)} style={styles.closeButton}>
                  <ThemedText style={styles.closeButtonText}>닫기</ThemedText>
                </Pressable>
              </View>
              {selectedNode?.nodetype === 'root' ? (
                <DetailField label="중심 주제" value={topicDraft} multiline={false} onChangeText={setTopicDraft} />
              ) : null}
              {selectedNode?.nodetype === 'branch' && !selectedNode.branchfield ? (
                <>
                  <DetailField label="분류 이름" value={topicDraft} multiline={false} onChangeText={setTopicDraft} />
                  <DetailField label="분류 설명" value={branchSummaryDraft} onChangeText={setBranchSummaryDraft} />
                </>
              ) : null}
              {selectedNode?.nodetype === 'branch' && selectedNode.branchfield ? (
                <View style={styles.fixedBranchNotice}>
                  <ThemedText style={styles.fieldLabel}>고정 필드 가지</ThemedText>
                  <ThemedText style={styles.modalHeadingSub}>
                    이 가지는 {getIdeaFieldLabel(selectedNode.branchfield)} 필드 전용이며 이름을 바꾸거나 삭제할 수 없습니다.
                  </ThemedText>
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
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setIsFullIdeaEditorOpen((current) => !current)}
                      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                      <ThemedText style={styles.secondaryButtonText}>
                        {isFullIdeaEditorOpen ? '전체 편집 닫기' : '원본 아이디어 전체 편집'}
                      </ThemedText>
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
                      {selectedNode?.nodetype === 'idea' && customBranches.length > 0 ? (
                        <View style={styles.field}>
                          <ThemedText style={styles.fieldLabel}>다른 사용자 정의 가지로 이동</ThemedText>
                          <View style={styles.branchChoices}>
                            {customBranches.map((branch) => (
                              <Pressable
                                key={branch.id}
                                disabled={selectedNode?.parentnodeid === branch.id}
                                onPress={() => (selectedNode ? void onMoveNode(selectedNode.id, branch.id) : undefined)}
                                style={({ pressed }) => [
                                  styles.branchChoice,
                                  selectedNode?.parentnodeid === branch.id && styles.activeBranchChoice,
                                  pressed && styles.pressed,
                                ]}>
                                <ThemedText
                                  style={[
                                    styles.branchChoiceText,
                                    selectedNode?.parentnodeid === branch.id && styles.activeBranchChoiceText,
                                  ]}>
                                  {branch.title}
                                </ThemedText>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : null}
              {selectedNode?.nodetype === 'branch' && !selectedNode.branchfield ? (
                <ThemedText style={styles.modalHeadingSub}>가지를 삭제해도 실제 아이디어는 목록에 보존됩니다.</ThemedText>
              ) : null}
              {localError ? <ThemedText style={styles.errorAlertText}>{localError}</ThemedText> : null}
              <View style={styles.detailActions}>
                {selectedNode?.nodetype === 'branch' && !selectedNode.branchfield ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSaving}
                    onPress={deleteSelectedBranch}
                    style={({ pressed }) => [styles.dangerButton, (pressed || isSaving) && styles.pressed]}>
                    <ThemedText style={styles.dangerButtonText}>삭제</ThemedText>
                  </Pressable>
                ) : null}
                {selectedIdea ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSaving}
                    onPress={deleteSelectedIdea}
                    style={({ pressed }) => [styles.dangerButton, (pressed || isSaving) && styles.pressed]}>
                    <ThemedText style={styles.dangerButtonText}>아이디어 삭제</ThemedText>
                  </Pressable>
                ) : null}
                {selectedNode?.nodetype === 'root' ||
                (selectedNode?.nodetype === 'branch' && !selectedNode.branchfield) ||
                (selectedIdea && (isFullIdeaEditorOpen || selectedIdeaField)) ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSaving}
                    onPress={() => void saveDetails()}
                    style={({ pressed }) => [styles.primaryButton, (pressed || isSaving) && styles.pressed]}>
                    {isSaving ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <ThemedText style={styles.whiteText}>저장</ThemedText>
                    )}
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  toolbarCopy: { flex: 1, minWidth: 240, gap: 2 },
  mapHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: PALETTE.text,
  },
  mapHeaderSub: {
    fontSize: 13,
    color: PALETTE.textSecondary,
  },
  toolbarActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  mapFrame: { position: 'relative' },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fixedZoomControls: {
    position: 'absolute',
    zIndex: 10,
    elevation: 10,
    top: Spacing.three,
    right: Spacing.three,
    borderWidth: 1,
    borderColor: PALETTE.cardBorder,
    backgroundColor: PALETTE.card,
    borderRadius: Radius.large,
    padding: 4,
  },
  zoomButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PALETTE.cardBorder,
    borderRadius: Radius.pill,
    backgroundColor: PALETTE.background,
  },
  zoomButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: PALETTE.text,
  },
  zoomBadge: {
    minWidth: 52,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PALETTE.cardBorder,
    borderRadius: Radius.medium,
    backgroundColor: PALETTE.card,
    paddingHorizontal: 6,
  },
  zoomBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.text,
  },
  viewport: {
    width: '100%',
    height: 620,
    borderWidth: 1,
    borderColor: PALETTE.cardBorder,
    borderRadius: Radius.large,
    backgroundColor: PALETTE.background,
  },
  nodeWrap: { position: 'absolute', width: nodeWidth, height: nodeHeight },
  node: {
    width: nodeWidth,
    height: nodeHeight,
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: Radius.large,
    padding: Spacing.two + 2,
  },
  rootNode: {
    backgroundColor: PALETTE.primary,
    borderColor: PALETTE.primaryDark,
  },
  branchNode: {
    backgroundColor: PALETTE.primaryLight,
    borderColor: '#FDE68A',
  },
  ideaNode: {
    backgroundColor: PALETTE.card,
    borderColor: PALETTE.cardBorder,
  },
  nodeBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: PALETTE.textSecondary,
  },
  rootBadge: {
    color: '#FFFBEB',
  },
  branchBadge: {
    color: PALETTE.primaryDark,
  },
  nodeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: PALETTE.text,
    lineHeight: 18,
  },
  rootTitle: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  branchTitle: {
    color: PALETTE.primaryDark,
  },
  nodeSummary: {
    fontSize: 11,
    color: PALETTE.textSecondary,
    lineHeight: 14,
  },
  rootSummary: {
    color: '#FEF3C7',
  },
  addNodeButton: {
    position: 'absolute',
    right: -10,
    top: -10,
    zIndex: 2,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: PALETTE.primaryDark,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  addNodeButtonText: {
    color: PALETTE.primaryDark,
    fontSize: 16,
    fontWeight: '800',
    marginTop: -2,
  },
  highlightedNode: {
    borderColor: PALETTE.success,
    borderWidth: 2.5,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.four,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: PALETTE.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: PALETTE.textSecondary,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.four,
    backgroundColor: PALETTE.primary,
  },
  secondaryButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PALETTE.cardBorder,
    backgroundColor: PALETTE.card,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.text,
  },
  whiteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    backgroundColor: PALETTE.overlay,
    padding: Spacing.three,
  },
  detailPanel: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    backgroundColor: PALETTE.card,
    borderColor: PALETTE.cardBorder,
    borderWidth: 1,
    borderRadius: Radius.large,
  },
  addNodePanel: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: PALETTE.card,
    borderColor: PALETTE.cardBorder,
    borderWidth: 1,
    borderRadius: Radius.large,
  },
  addNodeContent: { gap: Spacing.three, padding: Spacing.four },
  addNodeCopy: { gap: 4 },
  addNodeActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two, marginTop: Spacing.one },
  mobileDetailPanel: { maxWidth: undefined, maxHeight: '90%', alignSelf: 'stretch', marginTop: 'auto' },
  detailContent: { gap: Spacing.three, padding: Spacing.four },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.two },
  modalHeadingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: PALETTE.text,
  },
  modalHeadingSub: {
    fontSize: 13,
    color: PALETTE.textSecondary,
    lineHeight: 18,
  },
  detailActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two, marginTop: Spacing.one },
  dangerButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PALETTE.danger,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  dangerButtonText: {
    color: PALETTE.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  closeButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: Spacing.two },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: PALETTE.textSecondary,
  },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.text,
  },
  fixedBranchNotice: {
    gap: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: PALETTE.primaryLight,
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  advancedSection: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PALETTE.cardBorder,
    backgroundColor: PALETTE.card,
    borderRadius: Radius.medium,
  },
  advancedToggle: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  advancedToggleCopy: { flex: 1, gap: 2 },
  advancedDescription: {
    fontSize: 11,
    color: PALETTE.textSecondary,
  },
  advancedToggleBtn: {
    fontSize: 12,
    fontWeight: '700',
    color: PALETTE.primaryDark,
  },
  advancedFields: {
    gap: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: PALETTE.cardBorder,
    padding: Spacing.three,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: PALETTE.inputBorder,
    backgroundColor: PALETTE.inputBg,
    borderRadius: Radius.medium,
    color: PALETTE.text,
    fontSize: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  multilineInput: { minHeight: 76, textAlignVertical: 'top' },
  branchChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  branchChoice: {
    minHeight: 34,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PALETTE.cardBorder,
    backgroundColor: PALETTE.background,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
  },
  activeBranchChoice: {
    backgroundColor: PALETTE.primaryLight,
    borderColor: '#FDE68A',
  },
  branchChoiceText: {
    fontSize: 12,
    fontWeight: '600',
    color: PALETTE.textSecondary,
  },
  activeBranchChoiceText: {
    color: PALETTE.primaryDark,
    fontWeight: '700',
  },
  errorAlertText: {
    fontSize: 12,
    fontWeight: '600',
    color: PALETTE.danger,
  },
  pressed: { opacity: Platform.OS === 'web' ? 0.72 : 0.6 },
});
