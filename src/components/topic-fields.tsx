import { View } from 'react-native';
import { ScaledTextInput as TextInput } from '@/components/scaled-text-input';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { getTopicFields, normalizeTopicDetails, type TopicDetails } from '@/lib/topic-workspace';
import type { ProjectTemplate } from '@/types/project';

export function TopicFields({ template, details, keywords, onDetails, onKeywords, disabled = false }: {
  template: ProjectTemplate; details?: TopicDetails; keywords: string;
  onDetails: (details: TopicDetails) => void; onKeywords: (value: string) => void; disabled?: boolean;
}) {
  const theme = useTheme(), value = normalizeTopicDetails(details);
  const fields = getTopicFields(template);
  const inputStyle = { minHeight: 64, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12, color: theme.text, backgroundColor: theme.background, textAlignVertical: 'top' as const };
  return <View style={{ gap: 12 }}>
    {fields.map(field => <View key={field.key} style={{ gap: 6 }}>
      <ThemedText type="smallBold">{field.label}</ThemedText>
      <TextInput accessibilityLabel={field.label} multiline editable={!disabled} value={value[field.key]} placeholder={`${field.label} 입력`}
        placeholderTextColor={theme.textSecondary} onChangeText={text => onDetails({ ...value, [field.key]: text })} style={inputStyle} />
    </View>)}
    <View style={{ gap: 6 }}><ThemedText type="smallBold">키워드 (한 줄에 하나씩)</ThemedText>
      <TextInput accessibilityLabel="키워드" multiline editable={!disabled} value={keywords} onChangeText={onKeywords} style={inputStyle} />
    </View>
  </View>;
}
