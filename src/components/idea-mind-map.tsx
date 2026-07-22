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
  likeCountsByIdeaId?: Map<string, number>;
  likedIdeaIds?: Set<string>;
  isLoadingLikes?: boolean;
  onCreateNode: (input: IdeaInput, mindMapInput: IdeaMindMapInput) => Promise<MindMapMutationResult>;
  onUpdateNode: (id: string, input: IdeaInput) => Promise<MindMapMutationResult>;
  onPersistNodeLayout: (id: string, mindMapInput: IdeaMindMapInput) => Promise<MindMapMutationResult>;
  onToggleLike?: (idea: Idea) => void;
};

type LayoutedIdea = Idea & {
  mapx: number;
  mapy: number;
  visualparentid: string | null;
  shouldPersistLayout: boolean;
};

type AddDirection = Exclude<MindMapSide, 'center'>;

const nodeWidth = 230;
const nodeHeight = 172;
const nodeControlInset = 44;
const nodeWrapWidth = nodeWidth + nodeControlInset * 2;
const nodeWrapHeight = nodeHeight + nodeControlInset * 2;
const addButtonSize = 34;
const addButtonInset = (nodeControlInset - addButtonSize) / 2;
const nodeCollisionGap = 18;
const defaultMapWidth = 1320;
const defaultMapHeight = 820;
const defaultOriginX = defaultMapWidth / 2;
const defaultOriginY = defaultMapHeight / 2;
const mapPadding = 48;
const minMapZoom = 0.5;
const maxMapZoom = 1.6;
const mapZoomStep = 0.1;
const mapViewportHeight = 620;
const directionOffsets = [
  { side: 'right' as const, x: 340, y: 0 },
  { side: 'left' as const, x: -340, y: 0 },
  { side: 'bottom' as const, x: 0, y: 230 },
  { side: 'top' as const, x: 0, y: -230 },
  { side: 'bottomright' as const, x: 340, y: 230 },
  { side: 'bottomleft' as const, x: -340, y: 230 },
  { side: 'topright' as const, x: 340, y: -230 },
  { side: 'topleft' as const, x: -340, y: -230 },
];
const directionLabels: Record<AddDirection, string> = {
  left: '왼쪽',
  right: '오른쪽',
  top: '위',
  bottom: '아래',
  topleft: '왼쪽 위',
  topright: '오른쪽 위',
  bottomleft: '왼쪽 아래',
  bottomright: '오른쪽 아래',
};
const oppositeDirections: Record<AddDirection, AddDirection> = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
  topleft: 'bottomright',
  topright: 'bottomleft',
  bottomleft: 'topright',
  bottomright: 'topleft',
};

type MapPosition = {
  x: number;
  y: number;
};

function isAddDirection(side: MindMapSide | null): side is AddDirection {
  return Boolean(side && side !== 'center');
}

function isDirectionOccupied(idea: LayoutedIdea, direction: AddDirection, layoutedIdeas: LayoutedIdea[]) {
  const hasChildInDirection = layoutedIdeas.some(
    (childIdea) => childIdea.visualparentid === idea.id && childIdea.side === direction,
  );

  if (hasChildInDirection) {
    return true;
  }

  if (!idea.visualparentid || !isAddDirection(idea.side)) {
    return false;
  }

  return oppositeDirections[idea.side] === direction;
}

function isDirectionBlockedByOtherBranch(idea: LayoutedIdea, direction: AddDirection, layoutedIdeas: LayoutedIdea[]) {
  const offset = directionOffsets.find((item) => item.side === direction);

  if (!offset) {
    return false;
  }

  return doesPositionCollide(
    {
      x: idea.mapx + offset.x,
      y: idea.mapy + offset.y,
    },
    layoutedIdeas
      .filter((placedIdea) => placedIdea.id !== idea.id)
      .map((placedIdea) => ({ x: placedIdea.mapx, y: placedIdea.mapy })),
  );
}

function isDirectionAvailable(idea: LayoutedIdea, direction: AddDirection, layoutedIdeas: LayoutedIdea[]) {
  return (
    !isDirectionOccupied(idea, direction, layoutedIdeas) &&
    !isDirectionBlockedByOtherBranch(idea, direction, layoutedIdeas)
  );
}

function getNodeRect(position: MapPosition) {
  return {
    left: position.x - nodeWidth / 2 - nodeCollisionGap / 2,
    right: position.x + nodeWidth / 2 + nodeCollisionGap / 2,
    top: position.y - nodeHeight / 2 - nodeCollisionGap / 2,
    bottom: position.y + nodeHeight / 2 + nodeCollisionGap / 2,
  };
}

function doRectsOverlap(left: ReturnType<typeof getNodeRect>, right: ReturnType<typeof getNodeRect>) {
  return left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
}

function doesPositionCollide(position: MapPosition, placedNodes: MapPosition[]) {
  const nextRect = getNodeRect(position);

  return placedNodes.some((placedNode) => doRectsOverlap(nextRect, getNodeRect(placedNode)));
}

function findAvailablePosition(candidate: MapPosition, step: MapPosition, placedNodes: MapPosition[]) {
  let nextPosition = candidate;
  let wasAdjusted = false;
  const maxAttempts = placedNodes.length + 32;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!doesPositionCollide(nextPosition, placedNodes)) {
      return { position: nextPosition, wasAdjusted };
    }

    nextPosition = {
      x: nextPosition.x + step.x,
      y: nextPosition.y + step.y,
    };
    wasAdjusted = true;
  }

  return { position: nextPosition, wasAdjusted };
}

function getAddButtonPosition(side: AddDirection) {
  const centerX = nodeControlInset + nodeWidth / 2 - addButtonSize / 2;
  const centerY = nodeControlInset + nodeHeight / 2 - addButtonSize / 2;
  const left = addButtonInset;
  const right = nodeControlInset + nodeWidth + addButtonInset;
  const top = addButtonInset;
  const bottom = nodeControlInset + nodeHeight + addButtonInset;

  const positions: Record<AddDirection, { left: number; top: number }> = {
    top: { left: centerX, top },
    bottom: { left: centerX, top: bottom },
    left: { left, top: centerY },
    right: { left: right, top: centerY },
    topleft: { left, top },
    topright: { left: right, top },
    bottomleft: { left, top: bottom },
    bottomright: { left: right, top: bottom },
  };

  return positions[side];
}

function getMapBounds(layoutedIdeas: LayoutedIdea[]) {
  if (layoutedIdeas.length === 0) {
    return {
      width: defaultMapWidth,
      height: defaultMapHeight,
      originX: defaultOriginX,
      originY: defaultOriginY,
    };
  }

  const minX = Math.min(...layoutedIdeas.map((idea) => idea.mapx - nodeWidth / 2 - nodeControlInset));
  const maxX = Math.max(...layoutedIdeas.map((idea) => idea.mapx + nodeWidth / 2 + nodeControlInset));
  const minY = Math.min(...layoutedIdeas.map((idea) => idea.mapy - nodeHeight / 2 - nodeControlInset));
  const maxY = Math.max(...layoutedIdeas.map((idea) => idea.mapy + nodeHeight / 2 + nodeControlInset));
  let originX = defaultOriginX;
  let originY = defaultOriginY;
  let width = defaultMapWidth;
  let height = defaultMapHeight;

  if (originX + minX < mapPadding) {
    originX = mapPadding - minX;
  }

  if (originY + minY < mapPadding) {
    originY = mapPadding - minY;
  }

  if (originX + maxX > width - mapPadding) {
    width = originX + maxX + mapPadding;
  }

  if (originY + maxY > height - mapPadding) {
    height = originY + maxY + mapPadding;
  }

  return { width, height, originX, originY };
}

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
    side: 'center',
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
      const savedSideOffset = directionOffsets.find((offset) => offset.side === idea.side);
      const fallback = directionOffsets[index % directionOffsets.length];
      const nodeSide = savedSideOffset?.side ?? fallback.side;
      const ring = Math.floor(index / directionOffsets.length) + 1;
      const baseOffset = savedSideOffset ?? fallback;
      const candidate = hasSavedPosition(idea)
        ? { x: idea.x ?? 0, y: idea.y ?? 0 }
        : { x: parent.mapx + baseOffset.x * ring, y: parent.mapy + baseOffset.y * ring };
      const resolved = findAvailablePosition(
        candidate,
        { x: baseOffset.x, y: baseOffset.y },
        layouted.map((placedIdea) => ({ x: placedIdea.mapx, y: placedIdea.mapy })),
      );
      const node: LayoutedIdea = {
        ...idea,
        side: nodeSide,
        mapx: resolved.position.x,
        mapy: resolved.position.y,
        visualparentid: parent.id,
        shouldPersistLayout:
          !hasSavedPosition(idea) || idea.parentnodeid === null || idea.side !== nodeSide || resolved.wasAdjusted,
      };

      layouted.push(node);
      layoutById.set(node.id, node);
    });

  return layouted;
}

function MindMapNodeCard({
  idea,
  isBusy,
  isActive,
  likesCount,
  isLiked,
  isLoadingLikes,
  onActivate,
  onUpdateNode,
  onToggleLike,
}: {
  idea: LayoutedIdea;
  isBusy: boolean;
  isActive: boolean;
  likesCount: number;
  isLiked: boolean;
  isLoadingLikes: boolean;
  onActivate: () => void;
  onUpdateNode: (id: string, input: IdeaInput) => Promise<MindMapMutationResult>;
  onToggleLike?: (idea: Idea) => void;
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
    <ThemedView
      type="backgroundElement"
      onTouchStart={onActivate}
      style={[styles.nodeCard, isActive && styles.activeNodeCard]}>
      <View style={styles.nodeHeader}>
        <TextInput
          value={title}
          editable={!isBusy && !isSaving}
          onFocus={onActivate}
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
        onFocus={onActivate}
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
      <View style={styles.nodeReactionRow}>
        <Pressable
          disabled={isBusy || isLoadingLikes || !onToggleLike}
          accessibilityRole="button"
          accessibilityLabel={isLiked ? '공감 취소' : '공감하기'}
          onPress={() => onToggleLike?.(idea)}
          style={({ pressed }) => [
            styles.nodeLikeButton,
            isLiked && styles.activeNodeLikeButton,
            (pressed || isBusy || isLoadingLikes) && styles.pressed,
          ]}>
          {isLoadingLikes ? (
            <ActivityIndicator color={isLiked ? '#ffffff' : '#e11d48'} size="small" />
          ) : (
            <ThemedText type="smallBold" style={isLiked ? styles.activeNodeLikeText : styles.nodeLikeText}>
              ♥ {likesCount}
            </ThemedText>
          )}
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary" style={styles.nodeLikeCountText}>
          공감
        </ThemedText>
      </View>
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
  likeCountsByIdeaId,
  likedIdeaIds,
  isLoadingLikes = false,
  onCreateNode,
  onUpdateNode,
  onPersistNodeLayout,
  onToggleLike,
}: IdeaMindMapProps) {
  const [localError, setLocalError] = useState('');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const persistedLayoutIds = useRef(new Set<string>());
  const layoutedIdeas = useMemo(() => buildMindMapLayout(ideas), [ideas]);
  const layoutById = useMemo(
    () => new Map(layoutedIdeas.map((idea) => [idea.id, idea])),
    [layoutedIdeas],
  );
  const mapBounds = useMemo(() => getMapBounds(layoutedIdeas), [layoutedIdeas]);
  const visibleActiveNodeId = activeNodeId && layoutById.has(activeNodeId) ? activeNodeId : null;
  const mapZoomPercent = Math.round(mapZoom * 100);
  const canZoomOut = mapZoom > minMapZoom;
  const canZoomIn = mapZoom < maxMapZoom;
  const scaledMapWidth = mapBounds.width * mapZoom;
  const scaledMapHeight = mapBounds.height * mapZoom;

  const updateMapZoom = (delta: number) => {
    setMapZoom((currentZoom) => {
      const nextZoom = Math.round((currentZoom + delta) * 10) / 10;

      return Math.min(maxMapZoom, Math.max(minMapZoom, nextZoom));
    });
  };

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
        side: idea.visualparentid ? idea.side : 'center',
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

  const createChildNode = async (parent: LayoutedIdea, direction: AddDirection) => {
    setLocalError('');

    const canCreateInDirection = isDirectionAvailable(parent, direction, layoutedIdeas);

    if (!canCreateInDirection) {
      setLocalError(`${directionLabels[direction]} 방향에는 이미 다른 아이디어가 있습니다.`);
      return;
    }

    const offset = directionOffsets.find((item) => item.side === direction);

    if (!offset) {
      setLocalError('사용할 수 없는 방향입니다.');
      return;
    }

    const resolved = findAvailablePosition(
      {
        x: parent.mapx + offset.x,
        y: parent.mapy + offset.y,
      },
      { x: offset.x, y: offset.y },
      layoutedIdeas.map((idea) => ({ x: idea.mapx, y: idea.mapy })),
    );
    const result = await onCreateNode(
      {
        title: '새 아이디어',
        content: '마인드맵에서 추가한 생각입니다.',
        status: 'thought',
        category: 'planning',
      },
      {
        parentnodeid: parent.id,
        x: resolved.position.x,
        y: resolved.position.y,
        side: direction,
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
      <View style={styles.mapToolbar}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.mapHintText}>
        카드를 직접 수정하거나 + 버튼으로 연결 아이디어를 추가하세요.
        </ThemedText>
        <View style={styles.zoomControls}>
          <Pressable
            disabled={!canZoomOut}
            accessibilityRole="button"
            accessibilityLabel="마인드맵 축소"
            onPress={() => updateMapZoom(-mapZoomStep)}
            style={({ pressed }) => [styles.zoomButton, (!canZoomOut || pressed) && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.zoomButtonText}>
              -
            </ThemedText>
          </Pressable>
          <View style={styles.zoomPercentBadge}>
            <ThemedText type="smallBold" style={styles.zoomPercentText}>
              {mapZoomPercent}%
            </ThemedText>
          </View>
          <Pressable
            disabled={!canZoomIn}
            accessibilityRole="button"
            accessibilityLabel="마인드맵 확대"
            onPress={() => updateMapZoom(mapZoomStep)}
            style={({ pressed }) => [styles.zoomButton, (!canZoomIn || pressed) && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.zoomButtonText}>
              +
            </ThemedText>
          </Pressable>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        style={styles.mapViewport}
        contentContainerStyle={styles.horizontalMapContent}>
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator
          style={styles.verticalMapScroll}
          contentContainerStyle={styles.verticalMapContent}>
          <View style={[styles.scaledMapFrame, { width: scaledMapWidth, height: scaledMapHeight }]}>
            <View
              style={[
                styles.mapSurface,
                {
                  width: mapBounds.width,
                  height: mapBounds.height,
                  transform: [{ scale: mapZoom }],
                  transformOrigin: 'top left',
                },
              ]}>
            <Svg width={mapBounds.width} height={mapBounds.height} style={styles.connectorLayer}>
              {layoutedIdeas.map((idea) => {
                const parent = idea.visualparentid ? layoutById.get(idea.visualparentid) : undefined;

                if (!parent) {
                  return null;
                }

                return (
                  <Line
                    key={`${parent.id}-${idea.id}`}
                    x1={mapBounds.originX + parent.mapx}
                    y1={mapBounds.originY + parent.mapy}
                    x2={mapBounds.originX + idea.mapx}
                    y2={mapBounds.originY + idea.mapy}
                    stroke="#94a3b8"
                    strokeWidth={2}
                  />
                );
              })}
            </Svg>

            {layoutedIdeas.map((idea) => (
              <View
                key={idea.id}
                pointerEvents="box-none"
                style={[
                  styles.nodeWrap,
                  visibleActiveNodeId === idea.id && styles.activeNodeWrap,
                  {
                    left: mapBounds.originX + idea.mapx - nodeWidth / 2 - nodeControlInset,
                    top: mapBounds.originY + idea.mapy - nodeHeight / 2 - nodeControlInset,
                  },
                ]}>
                {visibleActiveNodeId === idea.id
                  ? directionOffsets.map((direction) => {
                      const canCreateInDirection = isDirectionAvailable(idea, direction.side, layoutedIdeas);

                      if (!canCreateInDirection) {
                        return null;
                      }

                      return (
                        <Pressable
                          key={direction.side}
                          disabled={isBusy}
                          accessibilityRole="button"
                          accessibilityLabel={`${idea.title} ${directionLabels[direction.side]} 방향 연결 아이디어 추가`}
                          onPress={() => createChildNode(idea, direction.side)}
                          style={({ pressed }) => [
                            styles.addNodeButton,
                            getAddButtonPosition(direction.side),
                            (pressed || isBusy) && styles.pressed,
                          ]}>
                          <ThemedText type="smallBold" style={styles.addNodeButtonText}>
                            +
                          </ThemedText>
                        </Pressable>
                      );
                    })
                  : null}
                <MindMapNodeCard
                  idea={idea}
                  isBusy={isBusy}
                  isActive={visibleActiveNodeId === idea.id}
                  likesCount={likeCountsByIdeaId?.get(idea.id) ?? 0}
                  isLiked={likedIdeaIds?.has(idea.id) ?? false}
                  isLoadingLikes={isLoadingLikes}
                  onActivate={() => setActiveNodeId(idea.id)}
                  onUpdateNode={onUpdateNode}
                  onToggleLike={onToggleLike}
                />
              </View>
            ))}
            </View>
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
    alignSelf: 'stretch',
    width: '100%',
  },
  mapToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  mapHintText: {
    flexShrink: 1,
  },
  zoomControls: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  zoomButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
  },
  zoomButtonText: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 22,
  },
  zoomPercentBadge: {
    minWidth: 58,
    height: 34,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
    backgroundColor: '#ffffff',
  },
  zoomPercentText: {
    color: '#0f172a',
    fontSize: 13,
    lineHeight: 17,
  },
  mapViewport: {
    width: '100%',
    height: mapViewportHeight,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: Spacing.two,
    backgroundColor: '#f8fafc',
  },
  horizontalMapContent: {
    minHeight: mapViewportHeight,
  },
  verticalMapScroll: {
    height: mapViewportHeight,
  },
  verticalMapContent: {
    minHeight: mapViewportHeight,
  },
  scaledMapFrame: {
    position: 'relative',
    overflow: 'hidden',
  },
  mapSurface: {
    position: 'relative',
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
    width: nodeWrapWidth,
    height: nodeWrapHeight,
  },
  activeNodeWrap: {
    zIndex: 20,
    elevation: 20,
  },
  nodeCard: {
    position: 'absolute',
    left: nodeControlInset,
    top: nodeControlInset,
    width: nodeWidth,
    height: nodeHeight,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: Spacing.two,
    padding: Spacing.two,
  },
  activeNodeCard: {
    borderColor: '#2563eb',
    borderWidth: 2,
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
  nodeReactionRow: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  nodeLikeButton: {
    minHeight: 26,
    minWidth: 52,
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  activeNodeLikeButton: {
    backgroundColor: '#e11d48',
    borderColor: '#e11d48',
  },
  nodeLikeText: {
    color: '#be123c',
  },
  activeNodeLikeText: {
    color: '#ffffff',
  },
  nodeLikeCountText: {
    fontSize: 12,
    lineHeight: 16,
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
    zIndex: 30,
    elevation: 30,
    width: addButtonSize,
    height: addButtonSize,
    borderRadius: addButtonSize / 2,
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
