import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
export async function workspaceDocx(text: string) {
  const doc = new Document({ sections: [{ children: text.split('\n').map(line => {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) return new Paragraph({ text: heading[2], heading: HeadingLevel.HEADING_2 });
    return new Paragraph({ children: line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map(part => new TextRun({ text: part.replace(/^\*{1,2}|\*{1,2}$/g, ''), bold: part.startsWith('**'), italics: part.startsWith('*') && !part.startsWith('**') })) });
  }) }] });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}
