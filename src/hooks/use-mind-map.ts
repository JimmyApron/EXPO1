import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { createIdeaFieldNodes, ideaFieldDefinitions, layoutMindMapNodes } from '@/lib/mind-map';
import { supabase } from '@/lib/supabase';
import type { Idea } from '@/types/idea';
import type { MindMap, MindMapNode } from '@/types/mind-map';

const mapSelect = 'id, projectid, userid, title, createdat, updatedat';
const nodeSelect = 'id, mindmapid, parentnodeid, ideaid, ideafield, branchfield, nodetype, title, summary, x, y, sortorder, createdat, updatedat';

export function useMindMap(projectId?: string, defaultTopic = '') {
  const { user } = useAuth();
  const [mindMap, setMindMap] = useState<MindMap | null>(null);
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [isLoadingMindMap, setIsLoadingMindMap] = useState(true);
  const [mindMapError, setMindMapError] = useState('');

  const loadMindMap = useCallback(async () => {
    if (!user || !projectId) {
      setMindMap(null);
      setNodes([]);
      setIsLoadingMindMap(false);
      return;
    }
    setIsLoadingMindMap(true);
    setMindMapError('');
    const { data, error } = await supabase.from('mindmaps').select(mapSelect).eq('projectid', projectId).maybeSingle();
    if (error) {
      setMindMapError(error.message);
      setIsLoadingMindMap(false);
      return;
    }
    let nextMap = (data as MindMap | null) ?? null;
    if (!nextMap) {
      const now = new Date().toISOString();
      const created = await supabase.from('mindmaps').insert({ projectid: projectId, userid: user.id, title: defaultTopic || '프로젝트 마인드맵', createdat: now, updatedat: now }).select(mapSelect).single();
      if (created.error) {
        const existing = await supabase.from('mindmaps').select(mapSelect).eq('projectid', projectId).maybeSingle();
        if (existing.error || !existing.data) {
          setMindMapError(created.error.message);
          setIsLoadingMindMap(false);
          return;
        }
        nextMap = existing.data as MindMap;
      } else {
        nextMap = created.data as MindMap;
      }
    }
    setMindMap(nextMap);
    if (nextMap) {
      const result = await supabase.from('mind_map_nodes').select(nodeSelect).eq('mindmapid', nextMap.id).order('sortorder');
      if (result.error) setMindMapError(result.error.message);
      else if ((result.data ?? []).length === 0) {
        const root = await supabase.from('mind_map_nodes').insert({ mindmapid: nextMap.id, userid: user.id, nodetype: 'root', title: nextMap.title, summary: '프로젝트의 중심 주제', x: 0, y: 0, sortorder: 0 }).select(nodeSelect).single();
        if (root.error) setMindMapError(root.error.message);
        else setNodes([root.data as MindMapNode]);
      } else setNodes((result.data ?? []) as MindMapNode[]);
    }
    setIsLoadingMindMap(false);
  }, [defaultTopic, projectId, user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => void loadMindMap(), 0);
    return () => globalThis.clearTimeout(timeout);
  }, [loadMindMap]);

  const ensureMindMap = useCallback(async (topic = defaultTopic) => {
    if (!user || !projectId) return { error: '로그인이 필요합니다.' };
    if (mindMap) {
      if (topic.trim() && topic.trim() !== mindMap.title) {
        const { error } = await supabase.from('mindmaps').update({ title: topic.trim(), updatedat: new Date().toISOString() }).eq('id', mindMap.id);
        if (error) return { error: error.message };
      }
      return { map: { ...mindMap, title: topic.trim() || mindMap.title } };
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('mindmaps').insert({ projectid: projectId, userid: user.id, title: topic.trim() || defaultTopic || '프로젝트 마인드맵', createdat: now, updatedat: now }).select(mapSelect).single();
    if (error) {
      const existing = await supabase.from('mindmaps').select(mapSelect).eq('projectid', projectId).maybeSingle();
      if (existing.error || !existing.data) return { error: error.message };
      return { map: existing.data as MindMap };
    }
    return { map: data as MindMap };
  }, [defaultTopic, mindMap, projectId, user]);

  const persistLayout = useCallback(async (nextNodes: MindMapNode[]) => {
    const laidOut = layoutMindMapNodes(nextNodes);
    const now = new Date().toISOString();
    const results = await Promise.all(laidOut.map((node) => supabase.from('mind_map_nodes').update({ x: node.x, y: node.y, sortorder: node.sortorder, updatedat: now }).eq('id', node.id)));
    const error = results.find((result) => result.error)?.error;
    return error ? { error: error.message, nodes: laidOut } : { nodes: laidOut };
  }, []);

  const composeIdeas = useCallback(async (ideas: Idea[], topic: string, _reclassifyExisting = false) => {
    const ensured = await ensureMindMap(topic);
    if (!ensured.map || !user) return { error: ensured.error || '마인드맵을 만들지 못했습니다.' };
    const map = ensured.map;
    const currentResult = await supabase.from('mind_map_nodes').select(nodeSelect).eq('mindmapid', map.id);
    if (currentResult.error) return { error: currentResult.error.message };
    let current = (currentResult.data ?? []) as MindMapNode[];
    let root = current.find((node) => node.nodetype === 'root');
    const rootTitle = topic.trim() || map.title;
    if (!root) {
      const result = await supabase.from('mind_map_nodes').insert({ mindmapid: map.id, userid: user.id, nodetype: 'root', title: rootTitle, summary: '프로젝트의 중심 주제', x: 0, y: 0, sortorder: 0 }).select(nodeSelect).single();
      if (result.error) return { error: result.error.message };
      root = result.data as MindMapNode;
      current = [...current, root];
    } else if (root.title !== rootTitle) {
      const updated = await supabase.from('mind_map_nodes').update({ title: rootTitle, updatedat: new Date().toISOString() }).eq('id', root.id);
      if (updated.error) return { error: updated.error.message };
      root = { ...root, title: rootTitle };
      current = current.map((node) => node.id === root?.id ? root! : node);
    }

    const fixedBranches = new Map<string, MindMapNode>();
    for (const [index, definition] of ideaFieldDefinitions.entries()) {
      let branch = current.find((node) => node.nodetype === 'branch' && node.branchfield === definition.field);
      if (!branch) {
        const sameTitle = current.find((node) => node.nodetype === 'branch' && !node.branchfield && node.title === definition.branchTitle);
        const payload = {
          parentnodeid: root.id,
          branchfield: definition.field,
          title: definition.branchTitle,
          summary: definition.summary,
          x: 360,
          y: 0,
          sortorder: index,
          updatedat: new Date().toISOString(),
        };
        const result = sameTitle
          ? await supabase.from('mind_map_nodes').update(payload).eq('id', sameTitle.id).select(nodeSelect).single()
          : await supabase.from('mind_map_nodes').upsert({ mindmapid: map.id, userid: user.id, nodetype: 'branch', ...payload }, { onConflict: 'mindmapid,branchfield' }).select(nodeSelect).single();
        if (result.error) return { error: result.error.message };
        branch = result.data as MindMapNode;
        current = sameTitle
          ? current.map((node) => node.id === sameTitle.id ? branch! : node)
          : [...current, branch];
      } else if (branch.parentnodeid !== root.id || branch.title !== definition.branchTitle || branch.summary !== definition.summary) {
        const result = await supabase.from('mind_map_nodes').update({ parentnodeid: root.id, title: definition.branchTitle, summary: definition.summary, sortorder: index, updatedat: new Date().toISOString() }).eq('id', branch.id).select(nodeSelect).single();
        if (result.error) return { error: result.error.message };
        branch = result.data as MindMapNode;
        current = current.map((node) => node.id === branch?.id ? branch! : node);
      }
      fixedBranches.set(definition.field, branch);
    }

    for (const idea of ideas) {
      const desiredNodes = createIdeaFieldNodes(idea);
      const desiredFields = new Set(desiredNodes.map((node) => node.ideafield));
      const staleNodeIds = current
        .filter((node) => node.nodetype === 'idea_field' && node.ideaid === idea.id && (!node.ideafield || !desiredFields.has(node.ideafield)))
        .map((node) => node.id);
      if (staleNodeIds.length > 0) {
        const removed = await supabase.from('mind_map_nodes').delete().in('id', staleNodeIds);
        if (removed.error) return { error: removed.error.message };
        current = current.filter((node) => !staleNodeIds.includes(node.id));
      }

      const oldAutomaticNodeIds = current
        .filter((node) => node.nodetype === 'idea' && node.ideaid === idea.id)
        .filter((node) => {
          const parent = node.parentnodeid ? current.find((candidate) => candidate.id === node.parentnodeid) : null;
          return parent?.branchfield != null || parent?.title === '기존 아이디어';
        })
        .map((node) => node.id);
      if (oldAutomaticNodeIds.length > 0) {
        const removed = await supabase.from('mind_map_nodes').delete().in('id', oldAutomaticNodeIds);
        if (removed.error) return { error: removed.error.message };
        current = current.filter((node) => !oldAutomaticNodeIds.includes(node.id));
      }

      for (const desired of desiredNodes) {
        const branch = fixedBranches.get(desired.ideafield);
        if (!branch) return { error: `${desired.branchTitle} 고정 가지를 만들지 못했습니다.` };
        const existingFieldNode = current.find((node) => node.ideaid === desired.ideaid && node.ideafield === desired.ideafield);
        const result = await supabase.from('mind_map_nodes').upsert({
          mindmapid: map.id,
          userid: user.id,
          parentnodeid: branch.id,
          ideaid: desired.ideaid,
          ideafield: desired.ideafield,
          nodetype: 'idea_field',
          title: desired.title,
          summary: desired.summary,
          x: 720,
          y: 0,
          sortorder: existingFieldNode?.sortorder ?? current.filter((node) => node.parentnodeid === branch.id).length,
          updatedat: new Date().toISOString(),
        }, { onConflict: 'mindmapid,ideaid,ideafield' }).select(nodeSelect).single();
        if (result.error) return { error: result.error.message };
        const saved = result.data as MindMapNode;
        const existingIndex = current.findIndex((node) => node.id === saved.id || (node.ideaid === saved.ideaid && node.ideafield === saved.ideafield));
        current = existingIndex >= 0
          ? current.map((node, index) => index === existingIndex ? saved : node)
          : [...current, saved];
      }
    }

    const refreshed = await supabase.from('mind_map_nodes').select(nodeSelect).eq('mindmapid', map.id);
    if (refreshed.error) return { error: refreshed.error.message };
    const layoutResult = await persistLayout((refreshed.data ?? []) as MindMapNode[]);
    if (layoutResult.error) return { error: layoutResult.error };
    await loadMindMap();
    return {};
  }, [ensureMindMap, loadMindMap, persistLayout, user]);

  const updateTopic = useCallback(async (title: string) => {
    if (!mindMap || !title.trim()) return { error: '중심 주제를 입력해 주세요.' };
    const now = new Date().toISOString();
    const [mapResult, rootResult] = await Promise.all([
      supabase.from('mindmaps').update({ title: title.trim(), updatedat: now }).eq('id', mindMap.id),
      supabase.from('mind_map_nodes').update({ title: title.trim(), updatedat: now }).eq('mindmapid', mindMap.id).eq('nodetype', 'root'),
    ]);
    const error = mapResult.error || rootResult.error;
    if (error) return { error: error.message };
    await loadMindMap();
    return {};
  }, [loadMindMap, mindMap]);

  const moveIdeaNode = useCallback(async (nodeId: string, branchId: string) => {
    const node = nodes.find((item) => item.id === nodeId);
    const branch = nodes.find((item) => item.id === branchId && item.nodetype === 'branch');
    if (!node || !branch) return { error: '이동할 노드 또는 가지를 찾을 수 없습니다.' };
    if (node.nodetype === 'idea_field') return { error: '필드 노드는 지정된 고정 가지에서 이동할 수 없습니다.' };
    if (branch.branchfield) return { error: '수동 아이디어 노드는 사용자 정의 가지로만 이동할 수 있습니다.' };
    const result = await supabase.from('mind_map_nodes').update({ parentnodeid: branchId, updatedat: new Date().toISOString() }).eq('id', nodeId).eq('nodetype', 'idea');
    if (result.error) return { error: result.error.message };
    if (mindMap) {
      const refreshed = await supabase.from('mind_map_nodes').select(nodeSelect).eq('mindmapid', mindMap.id);
      if (refreshed.error) return { error: refreshed.error.message };
      const layoutResult = await persistLayout((refreshed.data ?? []) as MindMapNode[]);
      if (layoutResult.error) return { error: layoutResult.error };
    }
    await loadMindMap();
    return {};
  }, [loadMindMap, mindMap, nodes, persistLayout]);

  const createBranch = useCallback(async (title: string, summary = '') => {
    if (!mindMap || !user || !title.trim()) return { error: '가지 이름을 입력해 주세요.' };
    const root = nodes.find((node) => node.nodetype === 'root');
    if (!root) return { error: '중심 노드를 찾을 수 없습니다.' };
    if (nodes.some((node) => node.nodetype === 'branch' && node.title.trim().toLocaleLowerCase() === title.trim().toLocaleLowerCase())) return { error: '같은 이름의 가지가 이미 있습니다.' };
    const inserted = await supabase.from('mind_map_nodes').insert({
      mindmapid: mindMap.id,
      userid: user.id,
      parentnodeid: root.id,
      nodetype: 'branch',
      title: title.trim(),
      summary: summary.trim() || `${title.trim()}에 관련된 아이디어`,
      x: 360,
      y: 0,
      sortorder: nodes.filter((node) => node.nodetype === 'branch').length,
    }).select(nodeSelect).single();
    if (inserted.error) return { error: inserted.error.message };
    const layoutResult = await persistLayout([...nodes, inserted.data as MindMapNode]);
    if (layoutResult.error) return { error: layoutResult.error };
    await loadMindMap();
    return {};
  }, [loadMindMap, mindMap, nodes, persistLayout, user]);

  const placeIdeaUnderBranch = useCallback(async (idea: Idea, branchId: string) => {
    if (!mindMap || !user) return { error: '마인드맵을 찾을 수 없습니다.' };
    const branch = nodes.find((node) => node.id === branchId && node.nodetype === 'branch');
    if (!branch) return { error: '아이디어를 추가할 가지를 찾을 수 없습니다.' };
    if (branch.branchfield) return composeIdeas([idea], mindMap.title);
    const existing = nodes.find((node) => node.nodetype === 'idea' && node.ideaid === idea.id && node.parentnodeid === branchId);
    if (existing) return {};
    const inserted = await supabase.from('mind_map_nodes').insert({
      mindmapid: mindMap.id,
      userid: user.id,
      parentnodeid: branchId,
      ideaid: idea.id,
      nodetype: 'idea',
      title: idea.title,
      summary: (idea.summary || idea.content).trim(),
      x: 720,
      y: 0,
      sortorder: nodes.filter((node) => node.parentnodeid === branchId).length,
    }).select(nodeSelect).single();
    if (inserted.error) return { error: inserted.error.message };
    const layoutResult = await persistLayout([...nodes, inserted.data as MindMapNode]);
    if (layoutResult.error) return { error: layoutResult.error };
    const syncResult = await composeIdeas([idea], mindMap.title);
    return syncResult.error ? { error: syncResult.error } : {};
  }, [composeIdeas, mindMap, nodes, persistLayout, user]);

  const updateBranch = useCallback(async (nodeId: string, title: string, summary: string) => {
    if (!mindMap || !title.trim()) return { error: '분류 이름을 입력해 주세요.' };
    const branch = nodes.find((node) => node.id === nodeId && node.nodetype === 'branch');
    if (!branch) return { error: '분류 가지를 찾을 수 없습니다.' };
    if (branch.branchfield) return { error: '고정 필드 가지는 이름이나 설명을 변경할 수 없습니다.' };
    const duplicate = nodes.some((node) => node.id !== nodeId && node.nodetype === 'branch' && node.title.trim().toLocaleLowerCase() === title.trim().toLocaleLowerCase());
    if (duplicate) return { error: '같은 이름의 가지가 이미 있습니다.' };
    const result = await supabase.from('mind_map_nodes').update({ title: title.trim(), summary: summary.trim(), updatedat: new Date().toISOString() }).eq('id', nodeId).eq('mindmapid', mindMap.id).eq('nodetype', 'branch');
    if (result.error) return { error: result.error.message };
    await loadMindMap();
    return {};
  }, [loadMindMap, mindMap, nodes]);

  const deleteBranch = useCallback(async (nodeId: string) => {
    if (!mindMap) return { error: '마인드맵을 찾을 수 없습니다.' };
    const branch = nodes.find((node) => node.id === nodeId && node.nodetype === 'branch');
    if (!branch) return { error: '삭제할 분류 가지를 찾을 수 없습니다.' };
    if (branch.branchfield) return { error: '고정 필드 가지는 삭제할 수 없습니다.' };
    const result = await supabase.from('mind_map_nodes').delete().eq('id', nodeId).eq('mindmapid', mindMap.id).eq('nodetype', 'branch');
    if (result.error) return { error: result.error.message };
    const remaining = nodes.filter((node) => node.id !== nodeId && node.parentnodeid !== nodeId);
    const layoutResult = await persistLayout(remaining);
    if (layoutResult.error) return { error: layoutResult.error };
    await loadMindMap();
    return {};
  }, [loadMindMap, mindMap, nodes, persistLayout]);

  return { mindMap, nodes, isLoadingMindMap, mindMapError, loadMindMap, composeIdeas, updateTopic, moveIdeaNode, createBranch, placeIdeaUnderBranch, updateBranch, deleteBranch };
}
