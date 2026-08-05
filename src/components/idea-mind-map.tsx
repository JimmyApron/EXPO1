import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  IdeaStatusLabels,
  normalizeIdeaCategory,
  normalizeIdeaStatus,
  type Idea,
  type IdeaInput,
  type IdeaMindMapInput,
  type MindMapSide,
} from '@/types/idea';

type MindMapMutationResult = {
  error?: string;
};

type IdeaMindMapProps = {
  ideas: Idea[];
  isBusy?: boolean;
  onCreateNode: (input: IdeaInput, mindMapInput: IdeaMindMapInput) => Promise<MindMapMutationResult>;
  onUpdateNode: (id: string, input: IdeaInput) => Promise<MindMapMutationResult>;
  onPersistNodeLayout: (id: string, mindMapInput: IdeaMindMapInput) => Promise<MindMapMutationResult>;
};

type LayoutedIdea = Idea & {
  mapx: number;
  mapy: number;
  visualparentid: string | null;
  shouldPersistLayout: boolean;
};

const nodeWidth = 230;
const nodeHeight = 150;
const mapWidth = 1320;
const mapHeight = 820;
const originX = mapWidth / 2;
const originY = mapHeight / 2;
const branchOffsets = [
  { side: 'right' as const, x: 340, y: 0 },
  { side: 'left' as const, x: -340, y: 0 },
  { side: 'bottom' as const, x: 0, y: 230 },
  { side: 'top' as const, x: 0, y: -230 },
  { side: 'bottomright' as const, x: 340, y: 230 },
  { side: 'bottomleft' as const, x: -340, y: 230 },
  { side: 'topright' as const, x: 340, y: -230 },
  { side: 'topleft' as const, x: -340, y: -230 },
];

function sortIdeas(ideas: Idea[]) {
  return [...ideas].sort((left, right) => {
    const leftTime = new Date(left.createdat).getTime();
    const rightTime = new Date(right.createdat).getTime();

    return leftTime - rightTime;
  });
}

function hasSavedPosition(idea: Idea) {
  return typeof idea.x === 'number' && typeof idea.y === 'number';
}

function buildMindMapLayout(ideas: Idea[]): LayoutedIdea[] {
  const sortedIdeas = sortIdeas(ideas);
  const centerIdea =
    sortedIdeas.find((idea) => idea.side === 'center') ??
    sortedIdeas.find((idea) => idea.parentnodeid === null && idea.x === 0 && idea.y === 0) ??
    sortedIdeas[0];

  if (!centerIdea) {
    return [];
  }

  const layouted: LayoutedIdea[] = [];
  const layoutById = new Map<string, LayoutedIdea>();
  const centerNode: LayoutedIdea = {
    ...centerIdea,
    mapx: hasSavedPosition(centerIdea) ? centerIdea.x ?? 0 : 0,
    mapy: hasSavedPosition(centerIdea) ? centerIdea.y ?? 0 : 0,
    visualparentid: null,
    shouldPersistLayout:
      !hasSavedPosition(centerIdea) || centerIdea.side !== 'center' || centerIdea.parentnodeid !== null,
  };

  layouted.push(centerNode);
  layoutById.set(centerNode.id, centerNode);

  sortedIdeas
    .filter((idea) => idea.id !== centerNode.id)
    .forEach((idea, index) => {
      const parent = (idea.parentnodeid ? layoutById.get(idea.parentnodeid) : centerNode) ?? centerNode;
      const fallback = branchOffsets[index % branchOffsets.length];
      const ring = Math.floor(index / branchOffsets.length) + 1;
      const mapx = hasSavedPosition(idea) ? idea.x ?? 0 : parent.mapx + fallback.x * ring;
      const mapy = hasSavedPosition(idea) ? idea.y ?? 0 : parent.mapy + fallback.y * ring;
      const node: LayoutedIdea = {
        ...idea,
        mapx,
        mapy,
        visualparentid: parent.id,
        shouldPersistLayout: !hasSavedPosition(idea) || idea.parentnodeid === null,
      };

      layouted.push(node);
      layoutById.set(node.id, node);
    });

  return layouted;
}

function MindMapNodeCard({
  idea,
  isBusy,
  onUpdateNode,
}: {
  idea: LayoutedIdea;
  isBusy: boolean;
  onUpdateNode: (id: string, input: IdeaInput) => Promise<MindMapMutationResult>;
}) {
  const theme = useTheme();
  const status = normalizeIdeaStatus(idea.status);
  const category = normalizeIdeaCategory(idea.category);
  const [title, setTitle] = useState(idea.title);
  const [content, setContent] = useState(idea.content);
  const [isSaving, setIsSaving] = useState(false);
  const [nodeError, setNodeError] = useState('');

  const isDirty = title !== idea.title || content !== idea.content;
  const canSave = isDirty && title.trim().length > 0 && content.trim().length > 0 && !isBusy && !isSaving;

  const saveNode = async () => {
    if (!canSave) {
      return;
    }

    setIsSaving(true);
    setNodeError('');

    const result = await onUpdateNode(idea.id, {
      title,
      content,
      status,
      category,
    });

    if (result.error) {
      setNodeError(result.error);
    }

    setIsSaving(false);
  };

  return (
    <ThemedView type="backgroundElement" style={styles.nodeCard}>
      <View style={styles.nodeHeader}>
        <TextInput
          value={title}
          editable={!isBusy && !isSaving}
          onChangeText={(value) => {
            setTitle(value);
            if (nodeError) {
              setNodeError('');
            }
          }}
          placeholder="아이디어 제목"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.nodeInput,
            styles.nodeTitleInput,
            {
              color: theme.text,
              borderColor: theme.backgroundSelected,
              backgroundColor: theme.background,
            },
          ]}
        />
        <ThemedText type="small" style={styles.statusText}>
          {IdeaStatusLabels[status]}
        </ThemedText>
      </View>
      <TextInput
        value={content}
        editable={!isBusy && !isSaving}
        multiline
        onChangeText={(value) => {
          setContent(value);
          if (nodeError) {
            setNodeError('');
          }
        }}
        placeholder="내용을 입력하세요."
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.nodeInput,
          styles.nodeContentInput,
          {
            color: theme.text,
            borderColor: theme.backgroundSelected,
            backgroundColor: theme.background,
          },
        ]}
      />
      {nodeError ? (
        <ThemedText type="small" style={styles.errorText}>
          {nodeError}
        </ThemedText>
      ) : null}
      {isDirty ? (
        <View style={styles.nodeActions}>
          <Pressable
            disabled={isBusy || isSaving}
            onPress={() => {
              setTitle(idea.title);
              setContent(idea.content);
              setNodeError('');
            }}
            style={({ pressed }) => [styles.nodeSecondaryButton, (pressed || isBusy || isSaving) && styles.pressed]}>
            <ThemedText type="smallBold">취소</ThemedText>
          </Pressable>
          <Pressable
            disabled={!canSave}
            onPress={saveNode}
            style={({ pressed }) => [styles.nodePrimaryButton, (pressed || !canSave) && styles.pressed]}>
            {isSaving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                저장
              </ThemedText>
            )}
          </Pressable>
        </View>
      ) : null}
    </ThemedView>
  );
}

export function IdeaMindMap({
  ideas,
  isBusy = false,
  onCreateNode,
  onUpdateNode,
  onPersistNodeLayout,
}: IdeaMindMapProps) {
  const [localError, setLocalError] = useState('');
  const persistedLayoutIds = useRef(new Set<string>());
  const layoutedIdeas = useMemo(() => buildMindMapLayout(ideas), [ideas]);
  const layoutById = useMemo(
    () => new Map(layoutedIdeas.map((idea) => [idea.id, idea])),
    [layoutedIdeas],
  );

  useEffect(() => {
    const layoutsToPersist = layoutedIdeas.filter(
      (idea) => idea.shouldPersistLayout && !persistedLayoutIds.current.has(idea.id),
    );

    layoutsToPersist.forEach((idea) => {
      persistedLayoutIds.current.add(idea.id);
      void onPersistNodeLayout(idea.id, {
        parentnodeid: idea.visualparentid,
        x: idea.mapx,
        y: idea.mapy,
        side: idea.visualparentid ? (idea.side ?? 'right') : 'center',
      });
    });
  }, [layoutedIdeas, onPersistNodeLayout]);

  const createCenterNode = async () => {
    setLocalError('');

    const result = await onCreateNode(
      {
        title: '중심 아이디어',
        content: '마인드맵의 시작점이 되는 핵심 생각입니다.',
        status: 'thought',
        category: 'planning',
      },
      {
        parentnodeid: null,
        x: 0,
        y: 0,
        side: 'center',
      },
    );

    if (result.error) {
      setLocalError(result.error);
    }
  };

  const createChildNode = async (parent: LayoutedIdea, offsetIndex: number) => {
    setLocalError('');

    const offset = branchOffsets[offsetIndex % branchOffsets.length];
    const sameParentCount = layoutedIdeas.filter((idea) => idea.visualparentid === parent.id).length;
    const result = await onCreateNode(
      {
        title: '새 아이디어',
        content: '마인드맵에서 추가한 생각입니다.',
        status: 'thought',
        category: 'planning',
      },
      {
        parentnodeid: parent.id,
        x: parent.mapx + offset.x,
        y: parent.mapy + offset.y + sameParentCount * 28,
        side: offset.side as MindMapSide,
      },
    );

    if (result.error) {
      setLocalError(result.error);
    }
  };

  if (ideas.length === 0) {
    return (
      <ThemedView type="backgroundElement" style={styles.emptyState}>
        <ThemedText type="smallBold">마인드맵에 표시할 아이디어가 없습니다.</ThemedText>
        <Pressable
          disabled={isBusy}
          onPress={createCenterNode}
          style={({ pressed }) => [styles.primaryButton, (pressed || isBusy) && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            중심 아이디어 추가
          </ThemedText>
        </Pressable>
        {localError ? (
          <ThemedText type="small" style={styles.errorText}>
            {localError}
          </ThemedText>
        ) : null}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        카드를 직접 수정하거나 + 버튼으로 연결 아이디어를 추가하세요.
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
          <View style={styles.mapSurface}>
            <Svg width={mapWidth} height={mapHeight} style={styles.connectorLayer}>
              {layoutedIdeas.map((idea) => {
                const parent = idea.visualparentid ? layoutById.get(idea.visualparentid) : undefined;

                if (!parent) {
                  return null;
                }

                return (
                  <Line
                    key={`${parent.id}-${idea.id}`}
                    x1={originX + parent.mapx}
                    y1={originY + parent.mapy}
                    x2={originX + idea.mapx}
                    y2={originY + idea.mapy}
                    stroke="#94a3b8"
                    strokeWidth={2}
                  />
                );
              })}
            </Svg>

            {layoutedIdeas.map((idea, index) => (
              <View
                key={idea.id}
                style={[
                  styles.nodeWrap,
                  {
                    left: originX + idea.mapx - nodeWidth / 2,
                    top: originY + idea.mapy - nodeHeight / 2,
                  },
                ]}>
                <Pressable
                  disabled={isBusy}
                  accessibilityRole="button"
                  accessibilityLabel={`${idea.title}에 연결 아이디어 추가`}
                  onPress={() => createChildNode(idea, index)}
                  style={({ pressed }) => [styles.addNodeButton, (pressed || isBusy) && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.addNodeButtonText}>
                    +
                  </ThemedText>
                </Pressable>
                <MindMapNodeCard idea={idea} isBusy={isBusy} onUpdateNode={onUpdateNode} />
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {localError ? (
        <ThemedText type="small" style={styles.errorText}>
          {localError}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  mapSurface: {
    position: 'relative',
    width: mapWidth,
    height: mapHeight,
    backgroundColor: '#f8fafc',
  },
  connectorLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  nodeWrap: {
    position: 'absolute',
    width: nodeWidth,
    height: nodeHeight + 42,
  },
  nodeCard: {
    position: 'absolute',
    left: 0,
    top: 42,
    width: nodeWidth,
    height: nodeHeight,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: Spacing.two,
    padding: Spacing.two,
  },
  nodeHeader: {
    gap: Spacing.half,
  },
  nodeInput: {
    borderWidth: 1,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  nodeTitleInput: {
    minHeight: 32,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  nodeContentInput: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    minHeight: 38,
    textAlignVertical: 'top',
  },
  statusText: {
    color: '#2563eb',
  },
  nodeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.one,
  },
  nodePrimaryButton: {
    minHeight: 28,
    borderRadius: Spacing.one,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  nodeSecondaryButton: {
    minHeight: 28,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  addNodeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
  },
  addNodeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.four,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: Spacing.two,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  errorText: {
    color: '#dc2626',
  },
  pressed: {
    opacity: 0.72,
  },
});
