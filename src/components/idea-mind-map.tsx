import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
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
  mapside: MindMapSide;
  visualparentid: string | null;
  shouldPersistLayout: boolean;
};

type BranchSide = Exclude<MindMapSide, 'center'>;

type WheelEventLike = {
  deltaY?: number;
  nativeEvent?: {
    deltaY?: number;
  };
  preventDefault?: () => void;
};

const nodeWidth = 220;
const nodeHeight = 132;
const nodeButtonSize = 34;
const nodeControlPadding = 82;
const nodeFrameWidth = nodeWidth + nodeControlPadding * 2;
const nodeFrameHeight = nodeHeight + nodeControlPadding * 2;
const stepX = 460;
const stepY = 320;
const mapPadding = 260;
const minZoom = 0.45;
const maxZoom = 2.1;
const zoomStep = 0.12;

const branchSides: BranchSide[] = [
  'right',
  'left',
  'top',
  'bottom',
  'topright',
  'topleft',
  'bottomright',
  'bottomleft',
];

const directionLabels: Record<BranchSide, string> = {
  left: 'left',
  right: 'right',
  top: 'top',
  bottom: 'bottom',
  topleft: 'top left',
  topright: 'top right',
  bottomleft: 'bottom left',
  bottomright: 'bottom right',
};

const directionOffsets: Record<BranchSide, { x: number; y: number }> = {
  left: { x: -stepX, y: 0 },
  right: { x: stepX, y: 0 },
  top: { x: 0, y: -stepY },
  bottom: { x: 0, y: stepY },
  topleft: { x: -stepX, y: -stepY },
  topright: { x: stepX, y: -stepY },
  bottomleft: { x: -stepX, y: stepY },
  bottomright: { x: stepX, y: stepY },
};

const buttonPositions: Record<BranchSide, { left?: number; right?: number; top?: number; bottom?: number }> = {
  left: { left: 14, top: nodeFrameHeight / 2 - nodeButtonSize / 2 },
  right: { right: 14, top: nodeFrameHeight / 2 - nodeButtonSize / 2 },
  top: { left: nodeFrameWidth / 2 - nodeButtonSize / 2, top: 14 },
  bottom: { left: nodeFrameWidth / 2 - nodeButtonSize / 2, bottom: 14 },
  topleft: { left: 42, top: 38 },
  topright: { right: 42, top: 38 },
  bottomleft: { left: 42, bottom: 38 },
  bottomright: { right: 42, bottom: 38 },
};

function clampZoom(value: number) {
  return Math.min(maxZoom, Math.max(minZoom, value));
}

function hasSavedPosition(idea: Idea) {
  return typeof idea.x === 'number' && typeof idea.y === 'number';
}

function sortIdeas(ideas: Idea[]) {
  return [...ideas].sort((left, right) => {
    const leftTime = new Date(left.createdat).getTime();
    const rightTime = new Date(right.createdat).getTime();

    return leftTime - rightTime;
  });
}

function isBranchSide(side: MindMapSide | null): side is BranchSide {
  return side !== null && side !== 'center';
}

function getNearestSide(x: number, y: number): BranchSide {
  if (Math.abs(x) < 80 && y < 0) {
    return 'top';
  }

  if (Math.abs(x) < 80 && y > 0) {
    return 'bottom';
  }

  if (x < 0 && y < -80) {
    return 'topleft';
  }

  if (x > 0 && y < -80) {
    return 'topright';
  }

  if (x < 0 && y > 80) {
    return 'bottomleft';
  }

  if (x > 0 && y > 80) {
    return 'bottomright';
  }

  return x < 0 ? 'left' : 'right';
}

function getLayoutSide(idea: Idea, fallback: BranchSide): BranchSide {
  if (isBranchSide(idea.side)) {
    return idea.side;
  }

  if (typeof idea.x === 'number' || typeof idea.y === 'number') {
    return getNearestSide(idea.x ?? 0, idea.y ?? 0);
  }

  return fallback;
}

function getNextRootPosition(index: number) {
  const side = branchSides[index % branchSides.length];
  const ring = Math.floor(index / branchSides.length) + 1;
  const offset = directionOffsets[side];

  return {
    side,
    x: offset.x * ring,
    y: offset.y * ring,
  };
}

function getNextChildPosition(parent: LayoutedIdea, side: BranchSide, index: number) {
  const offset = directionOffsets[side];
  const spread = index * 112;
  const isVertical = side === 'top' || side === 'bottom';
  const isHorizontal = side === 'left' || side === 'right';

  return {
    x: parent.mapx + offset.x + (isVertical ? spread : 0),
    y: parent.mapy + offset.y + (isHorizontal ? spread : 0),
  };
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
  const childCounters = new Map<string, Partial<Record<BranchSide, number>>>();
  let rootIndex = 0;

  const centerNode: LayoutedIdea = {
    ...centerIdea,
    mapx: hasSavedPosition(centerIdea) ? centerIdea.x ?? 0 : 0,
    mapy: hasSavedPosition(centerIdea) ? centerIdea.y ?? 0 : 0,
    mapside: 'center',
    visualparentid: null,
    shouldPersistLayout:
      !hasSavedPosition(centerIdea) || centerIdea.side !== 'center' || centerIdea.parentnodeid !== null,
  };

  layouted.push(centerNode);
  layoutById.set(centerNode.id, centerNode);

  sortedIdeas
    .filter((idea) => idea.id !== centerNode.id)
    .forEach((idea) => {
      const fallbackRoot = getNextRootPosition(rootIndex);
      const mapside = getLayoutSide(idea, fallbackRoot.side);
      const parentNode = idea.parentnodeid ? layoutById.get(idea.parentnodeid) : undefined;
      let mapx = idea.x ?? 0;
      let mapy = idea.y ?? 0;

      if (!hasSavedPosition(idea)) {
        if (parentNode) {
          const counters = childCounters.get(parentNode.id) ?? {};
          const childIndex = counters[mapside] ?? 0;
          const position = getNextChildPosition(parentNode, mapside, childIndex);

          counters[mapside] = childIndex + 1;
          childCounters.set(parentNode.id, counters);
          mapx = position.x;
          mapy = position.y;
        } else {
          mapx = fallbackRoot.x;
          mapy = fallbackRoot.y;
          rootIndex += 1;
        }
      } else if (!parentNode) {
        rootIndex += 1;
      }

      const node: LayoutedIdea = {
        ...idea,
        mapx,
        mapy,
        mapside,
        visualparentid: idea.parentnodeid ?? centerNode.id,
        shouldPersistLayout: !hasSavedPosition(idea) || idea.side === null,
      };

      layouted.push(node);
      layoutById.set(node.id, node);
    });

  return layouted;
}

function getMapSize(layoutedIdeas: LayoutedIdea[]) {
  const minX = Math.min(0, ...layoutedIdeas.map((idea) => idea.mapx));
  const maxX = Math.max(0, ...layoutedIdeas.map((idea) => idea.mapx));
  const minY = Math.min(0, ...layoutedIdeas.map((idea) => idea.mapy));
  const maxY = Math.max(0, ...layoutedIdeas.map((idea) => idea.mapy));
  const width = Math.max(1280, maxX - minX + nodeFrameWidth + mapPadding * 2);
  const height = Math.max(900, maxY - minY + nodeFrameHeight + mapPadding * 2);

  return {
    width,
    height,
    originX: mapPadding + nodeFrameWidth / 2 - minX,
    originY: mapPadding + nodeFrameHeight / 2 - minY,
  };
}

function getOccupiedBranches(layoutedIdeas: LayoutedIdea[]) {
  const occupiedBranches = new Map<string, Set<BranchSide>>();

  layoutedIdeas.forEach((idea) => {
    if (!idea.visualparentid || !isBranchSide(idea.mapside)) {
      return;
    }

    const parentBranches = occupiedBranches.get(idea.visualparentid) ?? new Set<BranchSide>();

    parentBranches.add(idea.mapside);
    occupiedBranches.set(idea.visualparentid, parentBranches);
  });

  return occupiedBranches;
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

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const isDirty = title !== idea.title || content !== idea.content;
  const canSave = isDirty && trimmedTitle.length > 0 && trimmedContent.length > 0 && !isBusy && !isSaving;
  const inputStyle = [
    styles.nodeInput,
    {
      color: theme.text,
      borderColor: theme.backgroundSelected,
      backgroundColor: theme.background,
    },
  ];

  const saveNode = async () => {
    if (!isDirty || isBusy || isSaving) {
      return;
    }

    if (!trimmedTitle || !trimmedContent) {
      setNodeError('제목과 내용을 입력해주세요.');
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
          style={[inputStyle, styles.nodeTitleInput]}
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
        placeholder="내용을 입력하세요"
        placeholderTextColor={theme.textSecondary}
        style={[inputStyle, styles.nodeContentInput]}
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
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const pinchStartZoomRef = useRef(1);
  const persistedLayoutIds = useRef(new Set<string>());
  const layoutedIdeas = useMemo(() => buildMindMapLayout(ideas), [ideas]);
  const mapSize = useMemo(() => getMapSize(layoutedIdeas), [layoutedIdeas]);
  const layoutById = useMemo(
    () => new Map(layoutedIdeas.map((idea) => [idea.id, idea])),
    [layoutedIdeas],
  );
  const occupiedBranches = useMemo(() => getOccupiedBranches(layoutedIdeas), [layoutedIdeas]);
  const scaledMapSize = useMemo(
    () => ({
      width: mapSize.width * zoom,
      height: mapSize.height * zoom,
    }),
    [mapSize.height, mapSize.width, zoom],
  );

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const layoutsToPersist = layoutedIdeas.filter(
      (idea) => idea.shouldPersistLayout && !persistedLayoutIds.current.has(idea.id),
    );

    if (layoutsToPersist.length === 0) {
      return;
    }

    layoutsToPersist.forEach((idea) => {
      persistedLayoutIds.current.add(idea.id);
      void onPersistNodeLayout(idea.id, {
        parentnodeid: idea.parentnodeid,
        x: idea.mapx,
        y: idea.mapy,
        side: idea.mapside,
      });
    });
  }, [layoutedIdeas, onPersistNodeLayout]);

  const handlePinchStart = useCallback(() => {
    pinchStartZoomRef.current = zoomRef.current;
  }, []);

  const handlePinchUpdate = useCallback((gestureScale: number) => {
    setZoom(clampZoom(pinchStartZoomRef.current * gestureScale));
  }, []);

  /* eslint-disable react-hooks/refs */
  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          runOnJS(handlePinchStart)();
        })
        .onUpdate((event) => {
          runOnJS(handlePinchUpdate)(event.scale);
        }),
    [handlePinchStart, handlePinchUpdate],
  );
  /* eslint-enable react-hooks/refs */

  const handleWheel = (event: WheelEventLike) => {
    if (Platform.OS !== 'web') {
      return;
    }

    event.preventDefault?.();
    const deltaY = event.deltaY ?? event.nativeEvent?.deltaY ?? 0;
    const direction = deltaY > 0 ? -1 : 1;
    setZoom((current) => clampZoom(current + direction * zoomStep));
  };

  const adjustZoom = (direction: -1 | 1) => {
    setZoom((current) => clampZoom(current + direction * zoomStep));
  };

  const createCenterNode = async () => {
    setLocalError('');

    const result = await onCreateNode(
      {
        title: '중앙 아이디어',
        content: '마인드맵의 시작점',
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

  const createChildNode = async (parent: LayoutedIdea, side: BranchSide) => {
    setLocalError('');

    if (occupiedBranches.get(parent.id)?.has(side)) {
      return;
    }

    const childCount = layoutedIdeas.filter(
      (idea) => idea.parentnodeid === parent.id && idea.mapside === side,
    ).length;
    const position = getNextChildPosition(parent, side, childCount);
    const result = await onCreateNode(
      {
        title: '새 아이디어',
        content: '마인드맵에서 추가한 생각',
        status: 'thought',
        category: 'planning',
      },
      {
        parentnodeid: parent.id,
        x: position.x,
        y: position.y,
        side,
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
            중앙 아이디어 추가하기
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
      <View style={styles.zoomBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="마인드맵 축소"
          onPress={() => adjustZoom(-1)}
          style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold">-</ThemedText>
        </Pressable>
        <ThemedText type="smallBold" style={styles.zoomValue}>
          {Math.round(zoom * 100)}%
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="마인드맵 확대"
          onPress={() => adjustZoom(1)}
          style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold">+</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="마인드맵 배율 초기화"
          onPress={() => setZoom(1)}
          style={({ pressed }) => [styles.resetZoomButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold">100%</ThemedText>
        </Pressable>
      </View>

      <GestureDetector gesture={pinchGesture}>
        <View style={styles.gestureArea}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
              <View
                style={[styles.mapSurface, { width: scaledMapSize.width, height: scaledMapSize.height }]}
                {...(Platform.OS === 'web' ? { onWheel: handleWheel } : {})}>
                <Svg width={scaledMapSize.width} height={scaledMapSize.height} style={styles.connectorLayer}>
                  {layoutedIdeas.map((idea) => {
                    const parent = idea.visualparentid ? layoutById.get(idea.visualparentid) : undefined;

                    if (!parent) {
                      return null;
                    }

                    return (
                      <Line
                        key={`${parent.id}-${idea.id}`}
                        x1={(mapSize.originX + parent.mapx) * zoom}
                        y1={(mapSize.originY + parent.mapy) * zoom}
                        x2={(mapSize.originX + idea.mapx) * zoom}
                        y2={(mapSize.originY + idea.mapy) * zoom}
                        stroke="#8c96a8"
                        strokeWidth={Math.max(1, 2 * zoom)}
                      />
                    );
                  })}
                </Svg>

                {layoutedIdeas.map((idea) => {
                  return (
                    <View
                      key={idea.id}
                      style={[
                        styles.nodeWrap,
                        {
                          left: (mapSize.originX + idea.mapx) * zoom - nodeFrameWidth / 2,
                          top: (mapSize.originY + idea.mapy) * zoom - nodeFrameHeight / 2,
                          transform: [{ scale: zoom }],
                        },
                      ]}>
                      {branchSides.map((side) => {
                        if (occupiedBranches.get(idea.id)?.has(side)) {
                          return null;
                        }

                        return (
                          <Pressable
                            key={side}
                            disabled={isBusy}
                            accessibilityRole="button"
                            accessibilityLabel={`${idea.title} ${directionLabels[side]} 아이디어 추가`}
                            onPress={() => createChildNode(idea, side)}
                            style={({ pressed }) => [
                              styles.addNodeButton,
                              buttonPositions[side],
                              (pressed || isBusy) && styles.pressed,
                            ]}>
                            <ThemedText type="smallBold" style={styles.addNodeButtonText}>
                              +
                            </ThemedText>
                          </Pressable>
                        );
                      })}

                      <MindMapNodeCard
                        key={idea.updatedat}
                        idea={idea}
                        isBusy={isBusy}
                        onUpdateNode={onUpdateNode}
                      />
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      </GestureDetector>

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
  zoomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  zoomButton: {
    width: 38,
    minHeight: 38,
    borderWidth: 1,
    borderColor: '#9aa2b1',
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetZoomButton: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: '#9aa2b1',
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  zoomValue: {
    minWidth: 54,
    textAlign: 'center',
  },
  gestureArea: {
    minHeight: 420,
  },
  mapSurface: {
    position: 'relative',
    backgroundColor: '#f7f8fb',
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
    width: nodeFrameWidth,
    height: nodeFrameHeight,
  },
  nodeCard: {
    position: 'absolute',
    left: nodeControlPadding,
    top: nodeControlPadding,
    width: nodeWidth,
    height: nodeHeight,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: '#d8dde8',
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
    color: '#2868d8',
  },
  nodeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.one,
  },
  nodePrimaryButton: {
    minHeight: 28,
    borderRadius: Spacing.one,
    backgroundColor: '#2868d8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  nodeSecondaryButton: {
    minHeight: 28,
    borderWidth: 1,
    borderColor: '#9aa2b1',
    borderRadius: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  addNodeButton: {
    position: 'absolute',
    width: nodeButtonSize,
    height: nodeButtonSize,
    borderRadius: nodeButtonSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2868d8',
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
    padding: Spacing.four,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: Spacing.two,
    backgroundColor: '#2868d8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  errorText: {
    color: '#d92d20',
  },
  pressed: {
    opacity: 0.72,
  },
});
