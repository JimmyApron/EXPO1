import type { DocumentWorkspace } from '../types/document-workspace.ts';
import type { ProjectSettings } from './topic-workspace.ts';
import { citationDraft, manuscriptText } from './document-workspace.ts';
import { escapeHtml } from '../utils/export/exportFormats.ts';

export function workspaceExportText(w: DocumentWorkspace, settings: ProjectSettings, report: boolean) {
  const citations = report ? w.resources.filter(r => r.used || w.outline.some(i => i.resourceIds.includes(r.id))) : [];
  return manuscriptText(w) + (citations.length ? '\n\n참고문헌 · 서식 초안 (출처 정보 확인 필요)\n\n' + citations.map((r, index) => citationDraft(r, settings.citationStyle, index + 1).text).join('\n\n') : '');
}
export function workspaceDocumentHtml(text: string, title: string) {
  const inline = (line: string) => escapeHtml(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4;margin:18mm}body{font-family:"Malgun Gothic","Apple SD Gothic Neo",sans-serif;line-height:1.8;color:#1e293b}p{white-space:pre-wrap;overflow-wrap:anywhere;orphans:3;widows:3}h1,h2,h3{break-after:avoid}</style></head><body>${text.split('\n').map(line => /^#{1,3}\s/.test(line) ? `<h2>${inline(line.replace(/^#+\s*/, ''))}</h2>` : `<p>${inline(line) || '&nbsp;'}</p>`).join('')}</body></html>`;
}
