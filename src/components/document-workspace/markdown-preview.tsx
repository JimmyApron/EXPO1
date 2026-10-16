import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
export function MarkdownPreview({ text }: { text: string }) {
  return <View style={{ gap: 8 }}>{text.split('\n').map((line, index) => {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) return <ThemedText key={index} selectable type={heading[1].length === 1 ? 'sectionTitle' : 'cardTitle'} style={{ marginTop: 12 }}>{heading[2]}</ThemedText>;
    if (!line) return <View key={index} style={{ height: 6 }} />;
    return <ThemedText key={index} selectable type="body">{line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, n) =>
      <ThemedText key={n} type="body" style={part.startsWith('**') ? { fontWeight: '700' } : part.startsWith('*') ? { fontStyle: 'italic' } : undefined}>{part.replace(/^\*{1,2}|\*{1,2}$/g, '')}</ThemedText>
    )}</ThemedText>;
  })}</View>;
}
