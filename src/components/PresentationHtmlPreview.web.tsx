import { createElement } from 'react';

export default function PresentationHtmlPreview({ html }: { html: string }) {
  return createElement('iframe', {
    title: 'HTML 발표자료 미리보기',
    srcDoc: html,
    sandbox: 'allow-same-origin',
    style: { width: '100%', minHeight: 620, border: '1px solid #d6dae0', borderRadius: 12, background: '#e9edf2' },
  });
}
