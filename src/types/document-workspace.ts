export type ResearchResource = {
  id: string; title: string; kind: string; source: string; author: string; date: string; url: string;
  content: string; summary: string; claim: string; memo: string; verified: boolean; used: boolean;
};
export type EvidenceCard = { id: string; title: string; content: string; resourceId: string; quote: string; memo: string };
export type OutlineItem = {
  id: string; parentId: string | null; title: string; guidance: string; targetLength: number | null;
  resourceIds: string[]; evidenceIds: string[]; body: string; completed: boolean; collapsed: boolean;
};
export type ManuscriptVersion = {
  id: string; label: string; createdAt: string; title: string; subtitle: string; outline: OutlineItem[]; freeBody: string;
};
export type WritingFeedback = {
  id: string; kind: string; outlineId: string | null; original: string; suggestion: string; reason: string;
  status: 'pending' | 'applied' | 'ignored';
};
export type WorkspaceSlide = { id: string; title: string; content: string; script: string };
export type DocumentWorkspace = {
  schemaVersion: 1; selectedIdeaId: string | null; title: string; subtitle: string;
  resources: ResearchResource[]; evidence: EvidenceCard[]; resourceComparison: string;
  outline: OutlineItem[]; freeBody: string; versions: ManuscriptVersion[]; feedback: WritingFeedback[];
  finalVersionId: string | null; finalFingerprint: string; finalTopicUpdatedAt: string;
  slides: WorkspaceSlide[]; qna: string; presentationFingerprint: string;
  presentation: { minutes: string; slideCount: string; purpose: string; audience: string; style: string };
  legacyNotes: Record<string, string>;
  reviewChecks: Record<string, boolean>;
};
