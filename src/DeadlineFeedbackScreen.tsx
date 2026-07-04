import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// 피드백 데이터 타입 정의
interface Feedback {
  id: string;
  content: string;
  createdAt: Date;
}

export default function DeadlineFeedbackScreen() {
  // 1. 상태 관리 (State)
  const [deadline, setDeadline] = useState<Date>(new Date('2026-08-31')); // 임시 마감일
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [newFeedback, setNewFeedback] = useState<string>('');
  
  // 과제 진행 상황 (임시 데이터)
  const ideaStats = {
    registered: 15,
    selected: 3,
  };

  // 2. D-day 계산 로직
  const calculateDDay = (targetDate: Date) => {
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) return `D-${diffDays}`;
    if (diffDays === 0) return `D-Day`;
    return `D+${Math.abs(diffDays)}`;
  };

  // 3. 피드백 추가 로직
  const handleAddFeedback = () => {
    if (newFeedback.trim() === '') return;
    
    const newEntry: Feedback = {
      id: Math.random().toString(36).substring(7),
      content: newFeedback,
      createdAt: new Date(),
    };
    
    setFeedbacks([newEntry, ...feedbacks]);
    setNewFeedback(''); // 입력창 초기화
  };

  return (
    <View style={styles.container}>
      {/* --- 마감일 및 D-day 표시 섹션 --- */}
      <View style={styles.card}>
        <Text style={styles.title}>과제 마감일: {deadline.toLocaleDateString()}</Text>
        <Text style={styles.dDayText}>{calculateDDay(deadline)}</Text>
      </View>

      {/* --- 과제 진행 상황 표시 섹션 --- */}
      <View style={styles.card}>
        <Text style={styles.title}>프로젝트 진행 상황</Text>
        <Text style={styles.statText}>💡 등록된 아이디어: {ideaStats.registered}개</Text>
        <Text style={styles.statText}>🏆 최종 선택된 아이디어: {ideaStats.selected}개</Text>
      </View>

      {/* --- 피드백 작성 및 목록 섹션 --- */}
      <View style={styles.card}>
        <Text style={styles.title}>아이디어 피드백 남기기</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="피드백을 입력해주세요..."
            value={newFeedback}
            onChangeText={setNewFeedback}
          />
          <TouchableOpacity style={styles.button} onPress={handleAddFeedback}>
            <Text style={styles.buttonText}>등록</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={feedbacks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.feedbackItem}>
              <Text style={styles.feedbackText}>{item.content}</Text>
              <Text style={styles.dateText}>{item.createdAt.toLocaleDateString()}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>아직 등록된 피드백이 없습니다.</Text>}
        />
      </View>
    </View>
  );
}

// 4. 스타일링 (CSS)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dDayText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginTop: 4,
  },
  statText: {
    fontSize: 16,
    marginTop: 4,
    color: '#34495e',
  },
  inputContainer: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
  },
  button: {
    backgroundColor: '#3498db',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  feedbackItem: {
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  feedbackText: {
    fontSize: 16,
  },
  dateText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 20,
  },
});