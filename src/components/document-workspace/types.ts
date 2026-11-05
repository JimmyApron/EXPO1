import type { useDocumentWorkspace } from '@/hooks/use-document-workspace';
import type { useWorkspaceAssistant } from '@/hooks/use-workspace-assistant';
export type WorkspaceController = ReturnType<typeof useDocumentWorkspace>;
export type WorkspaceAssistant = ReturnType<typeof useWorkspaceAssistant>;
