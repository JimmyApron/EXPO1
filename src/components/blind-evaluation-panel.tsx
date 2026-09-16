import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { Idea } from '@/types/idea';

const scoreOptions = ['1', '2', '3', '4', '5'];

type BlindEvaluationPanelProps = {
  projectId: string;
  ideas: Idea[];
  criteria: string[];
  onSubmitted?: () => void;
};

type EvaluationRow = { ideaid: string; scores: Record<string, number> };

export function BlindEvaluationPanel({ projectId, ideas, criteria, onSubmitted }: BlindEvaluationPanelProps) {
  const { user } = useAuth();
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadEvaluations() {
      if (!user || !projectId) {
        setIsLoading(false);
        return;
      }
      const result = await supabase
        .from('project_evaluations')
        .select('ideaid, scores')
        .eq('projectid', projectId)
        .eq('evaluatorid', user.id);
      if (!active) return;
      if (result.error) setError(result.error.message);
      else {
        const next: Record<string, Record<string, number>> = {};
        (result.data as EvaluationRow[] ?? []).forEach((row) => { next[row.ideaid] = row.scores ?? {}; });
        setScores(next);
      }
      setIsLoading(false);
    }
    void loadEvaluations();
    return () => { active = false; };
  }, [projectId, user]);

  const setScore = (ideaid: string, criterion: string, score: number) => {
    setSaved(false);
    setScores((current) => ({
      ...current,
      [ideaid]: { ...(current[ideaid] ?? {}), [criterion]: score },
    }));
  };

  const submit = async () => {
    if (!user) return;
    const incomplete = ideas.find((idea) => criteria.some((criterion) => !scores[idea.id]?.[criterion]));
    if (incomplete) {
      setError(`'${incomplete.title}' 아이디어의 모든 평가 기준을 입력해 주세요.`);
      return;
    }
    setIsSaving(true);
    setError('');
    const now = new Date().toISOString();
    const results = await Promise.all(ideas.map((idea) => supabase.from('project_evaluations').upsert({
      projectid: projectId,
      ideaid: idea.id,
      evaluatorid: user.id,
      scores: scores[idea.id],
      submittedat: now,
      updatedat: now,
    }, { onConflict: 'projectid,ideaid,evaluatorid' })));
    const failed = results.find((result) => result.error)?.error;
    if (failed) setError(failed.message);
    else { setSaved(true); onSubmitted?.(); }
    setIsSaving(false);
  };

  if (isLoading) return <ThemedView type="surface" style={styles.loading}><ActivityIndicator /></ThemedView>;
  if (ideas.length === 0) return null;

  return (
    <ThemedView type="surface" style={styles.container}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <ThemedText type="sectionTitle">블라인드 평가</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">평가자는 서로 공개되지 않으며, 각 기준을 1~5점으로 평가합니다.</ThemedText>
        </View>
        <View style={styles.anonymousBadge}><ThemedText type="captionStrong">익명 평가</ThemedText></View>
      </View>
      {ideas.map((idea) => (
        <View key={idea.id} style={styles.ideaRow}>
          <ThemedText type="smallBold">{idea.title}</ThemedText>
          {criteria.map((criterion) => (
            <View key={criterion} style={styles.criterionRow}>
              <ThemedText type="caption" themeColor="textSecondary">{criterion}</ThemedText>
              <View style={styles.scores}>
                {scoreOptions.map((option) => {
                  const selected = scores[idea.id]?.[criterion] === Number(option);
                  return <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setScore(idea.id, criterion, Number(option))} style={[styles.score, selected && styles.selectedScore]}><ThemedText type="captionStrong" style={selected ? styles.selectedText : undefined}>{option}</ThemedText></Pressable>;
                })}
              </View>
            </View>
          ))}
        </View>
      ))}
      {error ? <ThemedText accessibilityRole="alert" style={styles.error}>{error}</ThemedText> : null}
      <View style={styles.footer}>
        {saved ? <ThemedText type="small" style={styles.success}>평가가 저장되었습니다.</ThemedText> : null}
        <Pressable disabled={isSaving} onPress={() => void submit()} style={[styles.submit, isSaving && styles.disabled]}>{isSaving ? <ActivityIndicator color="#fff" /> : <ThemedText type="smallBold" style={styles.white}>평가 제출</ThemedText>}</Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderColor: '#d9dce8', borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.three },
  loading: { padding: Spacing.three, alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  copy: { flex: 1, gap: Spacing.one },
  anonymousBadge: { alignSelf: 'flex-start', borderRadius: Radius.pill, backgroundColor: '#E7F8EF', paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  ideaRow: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: Spacing.two, gap: Spacing.two },
  criterionRow: { gap: Spacing.one },
  scores: { flexDirection: 'row', gap: Spacing.one },
  score: { width: 34, height: 34, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center' },
  selectedScore: { backgroundColor: '#4050D0', borderColor: '#4050D0' },
  selectedText: { color: '#fff' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.two },
  submit: { minHeight: ControlHeight.button, backgroundColor: '#4050D0', borderRadius: Radius.medium, justifyContent: 'center', paddingHorizontal: Spacing.three },
  white: { color: '#fff' },
  success: { color: '#168B51' },
  error: { color: '#c2410c' },
  disabled: { opacity: 0.6 },
});
