import React, { createContext, useState, useEffect, useContext } from 'react';

const AppContext = createContext();

export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  // Navigation State
  const [currentView, setCurrentView] = useState('workspace');
  
  // Notification Feed
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'info', message: '구글 드라이브(PeerUp_PRD.docx) 연동이 완료되었습니다.', time: '10분 전', read: false },
    { id: 2, type: 'info', message: 'GitHub 저장소(peerup-web) 연동이 완료되었습니다.', time: '8분 전', read: false }
  ]);

  const addNotification = (type, message) => {
    setNotifications(prev => [
      { id: Date.now(), type, message, time: '방금 전', read: false },
      ...prev
    ]);
  };

  // User Profile & Points
  const [userProfile, setUserProfile] = useState({
    name: '김연세',
    school: '연세대학교',
    department: '컴퓨터과학과',
    grade: 3,
    walletPoints: 12000,
    peerUpScore: 84, // 협업 지수
    googleConnected: true,
    githubConnected: true,
    skills: ['React', 'JavaScript', 'HTML/CSS', 'Git'],
    badges: ['성실한 타이퍼', '첫 커밋', '에스크로 이용자', '클린 협업러']
  });

  // Feature 1: Real-time Project Contribution State
  const [project, setProject] = useState({
    name: 'PeerUp 핀테크 해커톤 프로젝트',
    googleDoc: 'PeerUp_기획서_V1.1',
    githubRepo: 'github.com/yonseidev/peerup-platform',
    contributors: {
      self: { name: '김연세 (나)', role: 'Frontend Developer', wordsTyped: 1240, commits: 18, status: 'active', lastActive: Date.now() },
      partner1: { name: '이민수', role: 'Backend Developer', wordsTyped: 1450, commits: 24, status: 'active', lastActive: Date.now() },
      partner2: { name: '박지영', role: 'UI/UX Designer', wordsTyped: 420, commits: 2, status: 'active', lastActive: Date.now() },
      partner3: { name: '최동현', role: 'Backend Developer', wordsTyped: 80, commits: 0, status: 'active', lastActive: Date.now() - 60000 }
    }
  });

  // Feature 2: Matchmaking Candidate Pool
  const [candidates, setCandidates] = useState([
    {
      id: 1,
      name: '정현우',
      role: 'Frontend Dev',
      school: '고려대학교',
      dept: '컴퓨터학과',
      peerUpScore: 94,
      matchRate: 98,
      skills: ['React', 'TypeScript', 'Next.js', 'Redux'],
      tags: ['피드백이 빨라요', '시간 약속 칼같음', '꼼꼼한 코드리뷰'],
      githubCommits: 142,
      docActivity: '상',
      matched: false
    },
    {
      id: 2,
      name: '이수아',
      role: 'UI/UX Designer',
      school: '홍익대학교',
      dept: '시각디자인과',
      peerUpScore: 91,
      matchRate: 95,
      skills: ['Figma', 'Adobe XD', 'Prototyping'],
      tags: ['의사소통이 활발해요', '기획 참여도 높음', '디자인 마감 엄수'],
      githubCommits: 0,
      docActivity: '최상',
      matched: false
    },
    {
      id: 3,
      name: '한상민',
      role: 'Backend Dev',
      school: '성균관대학교',
      dept: '소프트웨어학과',
      peerUpScore: 89,
      matchRate: 88,
      skills: ['Node.js', 'Express', 'MongoDB', 'AWS'],
      tags: ['과묵하지만 실속있음', '아키텍처 설계 강점', '오류 해결 해결사'],
      githubCommits: 185,
      docActivity: '중',
      matched: false
    },
    {
      id: 4,
      name: '윤아름',
      role: 'PM / Product Manager',
      school: '서강대학교',
      dept: '경영학과',
      peerUpScore: 96,
      matchRate: 92,
      skills: ['Jira', 'Notion', 'Agile', 'Wireframing'],
      tags: ['리더십이 뛰어남', '회의록 요정', '친화력 끝판왕'],
      githubCommits: 8,
      docActivity: '최상',
      matched: false
    }
  ]);

  // Feature 3: Career Roadmap Milestones & Specs
  const userSpecs = { gpa: 3.6, commits: 140, projects: 3, mentoring: 1, certification: 1 };
  const seniorSpecs = { gpa: 4.1, commits: 480, projects: 6, mentoring: 8, certification: 3 };

  const [roadmapNodes, setRoadmapNodes] = useState([
    // Year 1 & 2 Core Foundations
    { id: '1', title: '프로그래밍 기초 (C/Python)', category: 'major', status: 'completed', description: '전공 기초 지식을 습득하고 기본 프로그래밍 문법을 학습합니다.' },
    { id: '2', title: '자료구조 & 알고리즘 실습', category: 'major', status: 'completed', description: '효율적인 알고리즘 설계와 데이터 구조 처리를 습득합니다. (선배 이수율 98%)' },
    { id: '3', title: '개인 토이 프로젝트', category: 'project', status: 'completed', description: 'HTML, CSS, JS만으로 구성된 간단한 첫 포트폴리오 프로젝트 웹 구축.' },
    // Year 3 (Current Stage)
    { id: '4', title: '데이터베이스 및 운영체제', category: 'major', status: 'active', description: '트랜잭션 및 인덱스 설계, OS 프로세스 스케줄링 이론 및 실습 (현재 수강중)' },
    { id: '5', title: '팀 협업 해커톤 도전', category: 'project', status: 'active', description: '실제 팀을 매칭하여 구글 API/깃허브 연동 기반의 PeerUp 협업 기여도 검증 적용.' },
    // Year 4 Core & Career Path
    { id: '6', title: '선배 포트폴리오 에스크로 펀딩 리뷰', category: 'mentoring', status: 'pending', description: '네이버/카카오 현업 선배에게 익명 에스크로 펀딩을 통해 1:1 기획 및 코드 검증 리뷰.' },
    { id: '7', title: '클라우드 인프라 빌드업(AWS/GCP)', category: 'skill', status: 'pending', description: '컨테이너화(Docker), CI/CD 자동화 파이프라인 및 백엔드 배포 학습.' },
    { id: '8', title: '인턴십 실무 체험', category: 'career', status: 'pending', description: '검증된 협업 지수(PeerUp Score)를 인력 풀에 등록하여 IT 기업 연계 인턴 채용 진행.' }
  ]);

  // Feature 4: Mentorship & Escrow Review state
  const [mentors] = useState([
    { id: 1, name: '박태현 멘토', company: '네이버 (Senior Frontend Dev)', matchScore: 97, price: 5000, profileImg: '👨‍💻', bio: '전공 학점 4.2 | 깃허브 커밋 900+ | 프론트엔드 포트폴리오 전문 리뷰어' },
    { id: 2, name: '최지우 멘토', company: '카카오 (AI Engineering)', matchScore: 92, price: 6000, profileImg: '👩‍💻', bio: 'AI 및 웹 백엔드 서버 설계 전문 | 주니어 개발자의 협업 태도 피드백' },
    { id: 3, name: '이지훈 멘토', company: '토스 (UI/UX Designer Lead)', matchScore: 89, price: 4000, profileImg: '🎨', bio: '토스 디자인 시스템(TDS) 실무자 | 서비스 사용성 및 수상작 기획서 리뷰 전문' }
  ]);

  const [activeMentorship, setActiveMentorship] = useState(null);

  // Real-time Activity Simulation Tick logic
  useEffect(() => {
    const interval = setInterval(() => {
      setProject(prev => {
        const nextContributors = { ...prev.contributors };
        
        // Partner 1 (이민수 - Backend): Continually active
        if (nextContributors.partner1.status === 'active') {
          nextContributors.partner1.wordsTyped += Math.floor(Math.random() * 8) + 1;
          if (Math.random() < 0.15) {
            nextContributors.partner1.commits += 1;
          }
          nextContributors.partner1.lastActive = Date.now();
        }

        // Partner 2 (박지영 - Design): Randomly typed
        if (nextContributors.partner2.status === 'active') {
          if (Math.random() < 0.3) {
            nextContributors.partner2.wordsTyped += Math.floor(Math.random() * 4) + 1;
            nextContributors.partner2.lastActive = Date.now();
          }
        }

        // Partner 3 (최동현 - Backend): Sub-active or idle
        if (nextContributors.partner3.status === 'active') {
          // 8% chance to type something
          if (Math.random() < 0.08) {
            nextContributors.partner3.wordsTyped += 1;
            nextContributors.partner3.lastActive = Date.now();
          }
          // Check if idle for > 15 seconds
          if (Date.now() - nextContributors.partner3.lastActive > 15000) {
            nextContributors.partner3.status = 'idle';
            addNotification('warning', '팀원 최동현님의 구글 문서 활동이 감지되지 않아 자동으로 옐로우 카드(기여도 유도) 발송 대기 상태입니다.');
          }
        } else if (nextContributors.partner3.status === 'idle') {
          // If idle for > 30 seconds, trigger auto yellow card warning
          if (Date.now() - nextContributors.partner3.lastActive > 30000) {
            nextContributors.partner3.status = 'offline';
            addNotification('warning', '⚠️ 시스템 감지: 최동현님의 협업 점수가 기준치 이하로 떨어져 시스템이 익명 옐로우 카드(기여도 리마인드)를 발송했습니다.');
          }
        }

        return { ...prev, contributors: nextContributors };
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Action methods
  const addSelfActivity = (wordsCount, didCommit = false) => {
    setProject(prev => {
      const self = { ...prev.contributors.self };
      self.wordsTyped += wordsCount;
      if (didCommit) {
        self.commits += 1;
      }
      self.lastActive = Date.now();
      self.status = 'active';

      return {
        ...prev,
        contributors: {
          ...prev.contributors,
          self
        }
      };
    });
  };

  const nudgeTeammate = (partnerKey, isAnonymous = true) => {
    const name = project.contributors[partnerKey].name;
    addNotification('success', `${name}님에게 익명 옐로우 카드(기여 리마인드 알림)를 발송했습니다. 시스템이 발송하여 감정이 상하지 않습니다.`);
    
    setProject(prev => {
      const nextContributors = { ...prev.contributors };
      if (nextContributors[partnerKey]) {
        // Boost their activity status back to active shortly after nudge
        nextContributors[partnerKey].lastActive = Date.now();
        nextContributors[partnerKey].status = 'active';
        nextContributors[partnerKey].wordsTyped += 5; // Simulates teammate typing
      }
      return { ...prev, contributors: nextContributors };
    });
  };

  const simulatePartnerStatus = (partnerKey, status) => {
    setProject(prev => {
      const nextContributors = { ...prev.contributors };
      if (nextContributors[partnerKey]) {
        nextContributors[partnerKey].status = status;
        nextContributors[partnerKey].lastActive = status === 'active' ? Date.now() : Date.now() - 40000;
      }
      return { ...prev, contributors: nextContributors };
    });
    
    if (status === 'idle') {
      addNotification('warning', `시뮬레이터: ${project.contributors[partnerKey].name}님이 '잠수(Idle)' 상태로 전환되었습니다.`);
    } else if (status === 'active') {
      addNotification('info', `시뮬레이터: ${project.contributors[partnerKey].name}님이 '활성(Active)' 상태로 복귀했습니다.`);
    }
  };

  const requestMatch = (candidateId) => {
    setCandidates(prev => prev.map(c => {
      if (c.id === candidateId) {
        addNotification('info', `${c.name}님에게 해커톤 팀원 매칭 신청을 보냈습니다.`);
        // Simulating auto-match acceptance after 3 seconds
        setTimeout(() => {
          setCandidates(current => current.map(item => {
            if (item.id === candidateId) {
              addNotification('success', `🎉 ${item.name}님과의 매칭이 성사되었습니다! 팀 채널이 활성화됩니다.`);
              return { ...item, matched: true };
            }
            return item;
          }));
        }, 3000);
        return { ...c, matched: 'pending' };
      }
      return c;
    }));
  };

  const toggleRoadmapNode = (nodeId) => {
    setRoadmapNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        const nextStatus = n.status === 'completed' ? 'pending' : n.status === 'active' ? 'completed' : 'active';
        return { ...n, status: nextStatus };
      }
      return n;
    }));
  };

  // Mentorship Escrow Actions
  const initMentorship = (mentor) => {
    if (userProfile.walletPoints < mentor.price) {
      addNotification('error', '지갑에 포인트가 부족하여 멘토링 신청이 불가합니다. 프로필 탭에서 충전해주세요.');
      return;
    }

    setUserProfile(prev => ({ ...prev, walletPoints: prev.walletPoints - mentor.price }));
    
    const newMentorship = {
      mentor,
      status: 'deposited', // 1단계: 에스크로 예치완료
      portfolioUrl: 'https://docs.google.com/document/d/1_my_portfolio_draft',
      description: 'PeerUp 플랫폼 프론트엔드 핵심 아키텍처 및 기여도 시각화 기획 검토 부탁드립니다.',
      watermarkText: `PEERUP CONFIDENTIAL - ${userProfile.name}`,
      feedbackList: [
        { id: 1, author: '시스템', text: '5,000 포인트가 에스크로 지갑에 정상 예치되었습니다. 피드백이 완료되고 검수 후 멘토에게 지급됩니다.', time: '방금 전' }
      ]
    };

    setActiveMentorship(newMentorship);
    addNotification('violet', `💜 [에스크로 예치] ${mentor.name}님 멘토링에 5,000 포인트를 에스크로 안전 금고에 보관했습니다.`);
    
    // Simulate Mentor starting review after 2 seconds
    setTimeout(() => {
      setActiveMentorship(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'reviewing', // 2단계: 리뷰 작성중
          feedbackList: [
            ...prev.feedbackList,
            { id: 2, author: mentor.name, text: '포트폴리오 검토를 시작했습니다. 핵심 기여도 대시보드 로직에 대해 꼼꼼히 살펴보고 피드백 남겨 드릴게요.', time: '방금 전' }
          ]
        };
      });
      addNotification('info', `${mentor.name}님이 제출된 자료 검토를 시작했습니다.`);
    }, 4000);

    // Simulate Mentor completing review after 8 seconds
    setTimeout(() => {
      setActiveMentorship(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'reviewed', // 2.5단계: 리뷰 완료 (릴리즈 대기)
          feedbackList: [
            ...prev.feedbackList,
            { id: 3, author: mentor.name, text: '리뷰 완료! [피드백 의견] 1. 구글 드라이브 폴링 실시간 연동 시 부하 방지를 위해 Webhook 기반 Event-driven 방식을 사용한 것은 훌륭합니다. 2. 옐로우 카드를 발송할 때 사용자 피드백 가중치를 주는 알고리즘에 가동률(Activity Rate) 외에도 Git Commit 크기(line diff) 가중치를 부여하면 오차를 줄일 수 있을 것입니다.', time: '방금 전' },
            { id: 4, author: mentor.name, text: '💡 [음성 피드백 동봉] "안녕하세요 김연세 학생, 아키텍처 설계가 아주 우수하네요. 다만 캡처 방지용 가상 필터..."', time: '방금 전', hasAudio: true }
          ]
        };
      });
      addNotification('success', `${mentor.name}님의 피드백 작성이 완료되었습니다. 포트폴리오를 읽고 포인트 릴리즈를 결정하세요!`);
    }, 9000);
  };

  const releaseEscrowPoints = () => {
    if (!activeMentorship) return;
    
    setActiveMentorship(prev => ({
      ...prev,
      status: 'completed', // 3단계: 정산 완료
      feedbackList: [
        ...prev.feedbackList,
        { id: 5, author: '시스템', text: '포인트 정산 완료: 에스크로 지갑에서 멘토님의 계좌로 5,000 포인트가 즉시 송금되었습니다.', time: '방금 전' }
      ]
    }));

    setUserProfile(prev => ({
      ...prev,
      peerUpScore: Math.min(100, prev.peerUpScore + 3), // Mentorship completion boosts score
      badges: prev.badges.includes('멘토링 수료자') ? prev.badges : [...prev.badges, '멘토링 수료자']
    }));

    addNotification('success', `💜 [에스크로 완료] 피드백에 만족하여 펀딩 금액이 멘토에게 최종 지급되었습니다!`);
  };

  const chargePoints = (amount) => {
    setUserProfile(prev => ({ ...prev, walletPoints: prev.walletPoints + amount }));
    addNotification('success', `지갑에 ${amount.toLocaleString()} 포인트가 충전되었습니다.`);
  };

  return (
    <AppContext.Provider value={{
      currentView,
      setCurrentView,
      notifications,
      addNotification,
      userProfile,
      project,
      candidates,
      roadmapNodes,
      userSpecs,
      seniorSpecs,
      mentors,
      activeMentorship,
      addSelfActivity,
      nudgeTeammate,
      simulatePartnerStatus,
      requestMatch,
      toggleRoadmapNode,
      initMentorship,
      releaseEscrowPoints,
      chargePoints
    }}>
      {children}
    </AppContext.Provider>
  );
};
