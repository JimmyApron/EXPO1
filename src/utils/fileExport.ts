import { Alert, Clipboard, Platform } from 'react-native';

const sanitizeFileName = (fileName: string) =>
  fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '');

const downloadBlob = (blob: Blob, fileName: string) => {
  const element = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);

  element.href = objectUrl;
  element.download = sanitizeFileName(fileName);
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};

export const copyToClipboard = async (text: string) => {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      await Clipboard.setString(text);
    }

    Alert.alert('복사 완료', '클립보드에 복사되었습니다.');
  } catch (error) {
    console.error('복사 실패:', error);
    Alert.alert('복사 실패', '클립보드 복사에 실패했습니다.');
  }
};

export const downloadAsFile = (content: string, fileName: string) => {
  if (Platform.OS === 'web') {
    const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
    downloadBlob(file, fileName);

    return;
  }

  Alert.alert('다운로드 지원', '이 환경에서는 파일 다운로드를 직접 지원하지 않습니다.');
};

type DocxDocumentOptions = {
  documentType: string;
  projectTitle: string;
};

export const downloadAsDocx = async (
  content: string,
  fileName: string,
  { documentType, projectTitle }: DocxDocumentOptions,
) => {
  if (Platform.OS !== 'web') {
    Alert.alert('다운로드 지원', '현재 Word 문서 다운로드는 웹에서 지원됩니다.');
    return;
  }

  try {
    const {
      AlignmentType,
      BorderStyle,
      Document,
      Footer,
      Header,
      HeadingLevel,
      LevelFormat,
      Packer,
      PageBreak,
      PageNumber,
      Paragraph,
      ShadingType,
      TextRun,
    } = await import('docx');
    const colors = {
      accent: '2563EB',
      dark: '172033',
      muted: '667085',
      pale: 'EFF6FF',
      rule: 'D9E2F0',
      white: 'FFFFFF',
    };
    const bodyFont = { ascii: 'Aptos', eastAsia: '맑은 고딕', hAnsi: 'Aptos' };
    const generatedDate = new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
    const headingLevels = [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4,
      HeadingLevel.HEADING_5,
      HeadingLevel.HEADING_6,
    ];

    const inlineRuns = (markdown: string) => {
      const linkedText = markdown
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1');

      return linkedText
        .split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g)
        .filter(Boolean)
        .map((part) => {
          const bold = /^(\*\*|__).+(\*\*|__)$/.test(part);
          const code = /^`.+`$/.test(part);
          return new TextRun({
            text: bold ? part.slice(2, -2) : code ? part.slice(1, -1) : part,
            bold,
            color: code ? colors.accent : colors.dark,
            font: code ? 'Consolas' : bodyFont,
            shading: code ? { type: ShadingType.CLEAR, fill: colors.pale } : undefined,
          });
        });
    };

    let skippedDocumentTitle = false;
    const paragraphs = content.split(/\r?\n/).flatMap((line) => {
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        if (heading[1].length === 1 && !skippedDocumentTitle) {
          skippedDocumentTitle = true;
          return [];
        }

        return [
          new Paragraph({
            children: inlineRuns(heading[2]),
            heading: headingLevels[Math.max(0, heading[1].length - 2)],
          }),
        ];
      }

      if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
        return [
          new Paragraph({
            border: { bottom: { color: colors.rule, style: BorderStyle.SINGLE, size: 6 } },
            spacing: { before: 120, after: 220 },
          }),
        ];
      }

      const bullet = line.match(/^(\s*)[-*+]\s+(.+)$/);
      if (bullet) {
        return [
          new Paragraph({
            children: inlineRuns(bullet[2]),
            bullet: { level: Math.min(2, Math.floor(bullet[1].length / 2)) },
            spacing: { after: 80, line: 300 },
          }),
        ];
      }

      const ordered = line.match(/^(\s*)\d+[.)]\s+(.+)$/);
      if (ordered) {
        return [
          new Paragraph({
            children: inlineRuns(ordered[2]),
            numbering: {
              reference: 'professional-numbering',
              level: Math.min(2, Math.floor(ordered[1].length / 2)),
            },
            spacing: { after: 80, line: 300 },
          }),
        ];
      }

      const quote = line.match(/^\s*>\s?(.*)$/);
      if (quote) {
        return [
          new Paragraph({
            children: inlineRuns(quote[1]),
            shading: { type: ShadingType.CLEAR, fill: colors.pale },
            border: { left: { color: colors.accent, style: BorderStyle.SINGLE, size: 18 } },
            indent: { left: 300, right: 240 },
            spacing: { before: 100, after: 180, line: 320 },
          }),
        ];
      }

      if (!line.trim()) {
        return [new Paragraph({ spacing: { after: 80 } })];
      }

      return [
        new Paragraph({
          children: inlineRuns(line),
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 160, line: 340 },
        }),
      ];
    });

    const emptyHeader = new Header({ children: [new Paragraph('')] });
    const emptyFooter = new Footer({ children: [new Paragraph('')] });
    const defaultHeader = new Header({
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { color: colors.rule, style: BorderStyle.SINGLE, size: 6 } },
          spacing: { after: 120 },
          children: [
            new TextRun({ text: projectTitle, bold: true, color: colors.dark, size: 18, font: bodyFont }),
            new TextRun({ text: `  |  ${documentType}`, color: colors.muted, size: 18, font: bodyFont }),
          ],
        }),
      ],
    });
    const defaultFooter = new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { color: colors.rule, style: BorderStyle.SINGLE, size: 6 } },
          spacing: { before: 120 },
          children: [
            new TextRun({ text: `${generatedDate}   ·   `, color: colors.muted, size: 17, font: bodyFont }),
            new TextRun({ text: 'PAGE ', color: colors.muted, size: 17, font: bodyFont }),
            new TextRun({ children: [PageNumber.CURRENT], color: colors.muted, size: 17, font: bodyFont }),
            new TextRun({ text: ' / ', color: colors.muted, size: 17, font: bodyFont }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], color: colors.muted, size: 17, font: bodyFont }),
          ],
        }),
      ],
    });
    const cover = [
      new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: colors.accent },
        spacing: { after: 900 },
        children: [new TextRun({ text: ' ', size: 12 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: 'PROJECT DOCUMENT',
            bold: true,
            allCaps: true,
            characterSpacing: 80,
            color: colors.accent,
            size: 18,
            font: 'Aptos',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 260 },
        children: [new TextRun({ text: projectTitle, bold: true, color: colors.dark, size: 52, font: bodyFont })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 760 },
        children: [new TextRun({ text: documentType, bold: true, color: colors.accent, size: 30, font: bodyFont })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({ text: '작성일', color: colors.muted, size: 18, font: bodyFont })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: generatedDate, bold: true, color: colors.dark, size: 22, font: bodyFont })],
      }),
      new Paragraph({ children: [new PageBreak()] }),
    ];

    const document = new Document({
      title: `${projectTitle} ${documentType}`,
      subject: documentType,
      description: `${projectTitle} 프로젝트의 ${documentType}`,
      keywords: `${projectTitle}, ${documentType}, 프로젝트`,
      styles: {
        default: {
          document: {
            run: { font: bodyFont, size: 21, color: colors.dark, language: { eastAsia: 'ko-KR' } },
            paragraph: { spacing: { line: 340, after: 140 } },
          },
          heading1: {
            run: { font: bodyFont, size: 31, bold: true, color: colors.dark },
            paragraph: {
              keepNext: true,
              spacing: { before: 360, after: 180 },
              border: { bottom: { color: colors.accent, style: BorderStyle.SINGLE, size: 12 } },
            },
          },
          heading2: {
            run: { font: bodyFont, size: 25, bold: true, color: colors.accent },
            paragraph: { keepNext: true, spacing: { before: 280, after: 140 } },
          },
          heading3: {
            run: { font: bodyFont, size: 22, bold: true, color: colors.dark },
            paragraph: { keepNext: true, spacing: { before: 220, after: 100 } },
          },
        },
      },
      numbering: {
        config: [
          {
            reference: 'professional-numbering',
            levels: [0, 1, 2].map((level) => ({
              level,
              format: LevelFormat.DECIMAL,
              text: `%${level + 1}.`,
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 720 + level * 360, hanging: 320 } },
              },
            })),
          },
        ],
      },
      sections: [
        {
          properties: {
            titlePage: true,
            page: {
              margin: { top: 1080, right: 1260, bottom: 1080, left: 1260, header: 540, footer: 540 },
            },
          },
          headers: { first: emptyHeader, default: defaultHeader },
          footers: { first: emptyFooter, default: defaultFooter },
          children: [...cover, ...paragraphs],
        },
      ],
    });
    const blob = await Packer.toBlob(document);
    downloadBlob(blob, fileName.endsWith('.docx') ? fileName : `${fileName}.docx`);
  } catch (error) {
    console.error('Word 문서 생성 실패:', error);
    Alert.alert('다운로드 실패', 'Word 문서를 생성하지 못했습니다. 다시 시도해 주세요.');
  }
};
