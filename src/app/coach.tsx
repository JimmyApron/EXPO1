import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

// 팀원이 공유해 준 공통 예시 데이터
const sampleProjectConditions = {
  durationWeeks: 6,
  teamSize: 4,
  skillLevel: "초급~중급",
  budget: 100000,
  evaluationCriteria: ["창의성", "구현 가능성", "사용자 편의성", "완성도"]
};

const sampleCandidateIdeas = [
  {
    id: "idea-001",
    title: "AI 회의 아이디어 정리 서비스",
    summary: "회의와 채팅에서 아이디어를 추출하고 실행 계획까지 만들어주는 서비스",
    problem: "회의가 끝난 후 아이디어가 정리되지 않는다.",
    keywords: ["AI", "회의 정리", "아이디어"]
  },
  {
    id: "idea-002",
    title: "AI 팀원 역할 추천 서비스",
    summary: "팀원의 경험과 기술을 분석해 프로젝트 역할을 추천하는 서비스",
    problem: "프로젝트 초기에 역할을 공정하게 나누기 어렵다.",
    keywords: ["팀 빌딩", "역할 분담", "일정 관리"]
  },
  {
    id: "idea-003",
    title: "공모전 맞춤 아이디어 추천 서비스",
    summary: "공모전 조건에 맞는 아이디어를 추천하고 평가해주는 서비스",
    problem: "공모전 주제와 평가 기준에 적합한 아이디어를 선정하기 어렵다.",
    keywords: ["공모전", "아이디어 추천", "AI 코치"]
  }
];

export default function CoachScreen() {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  // Claude AI (Supabase Edge Function) 분석 호출
  const handleRunAiCoach = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-final-ideas', {
        body: {
          projectConditions: sampleProjectConditions,
          candidateIdeas: sampleCandidateIdeas
        }
      });

      if (error) throw error;
      console.log("AI 분석 성공:", data);
      setAnalysis(data);
    } catch (err) {
      console.error("AI 분석 연동 에러:", err);
      alert("AI 코치 분석을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🎯 AI Project Coach</Text>
      
      {/* 1. 프로젝트 조건 카드 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📋 현재 프로젝트 조건</Text>
        <Text>• 기간: {sampleProjectConditions.durationWeeks}주</Text>
        <Text>• 인원: {sampleProjectConditions.teamSize}명</Text>
        <Text>• 난이도: {sampleProjectConditions.skillLevel}</Text>
        <Text>• 예산: {sampleProjectConditions.budget.toLocaleString()}원</Text>
      </View>

      {/* 2. AI 분석 실행 버튼 */}
      <TouchableOpacity style={styles.button} onPress={handleRunAiCoach} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>🤖 AI 아이디어 적합도 분석하기</Text>
        )}
      </TouchableOpacity>

      {/* 3. AI 결과 출력 */}
      {analysis && (
        <View style={styles.resultCard}>
          <Text style={styles.cardTitle}>✨ AI 코치 비교 분석 리포트</Text>
          <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {JSON.stringify(analysis, null, 2)}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8f9fa' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, marginTop: 40 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  button: { backgroundColor: '#4A90E2', padding: 16, borderRadius: 12, alignItems: 'center', marginVertical: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  resultCard: { backgroundColor: '#EBF3FF', padding: 16, borderRadius: 12, marginTop: 10, marginBottom: 40 }
});