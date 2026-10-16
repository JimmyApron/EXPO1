import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useExperience } from '@/context/ExperienceContext';
export function ExperienceSettings() {
  const { fontSize, setFontSize, error } = useExperience();
  return <View style={{ gap: 12 }}><ThemedText type="cardTitle">글자 크기</ThemedText><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
    {(['small', 'default', 'large'] as const).map((size, i) => <Pressable key={size} accessibilityRole="radio" accessibilityLabel={`글자 크기 ${['작게', '기본', '크게'][i]}`} accessibilityState={{ checked: fontSize === size }} onPress={() => setFontSize(size)} style={{ padding: 12, borderWidth: fontSize === size ? 2 : 1, borderColor: '#d97706', borderRadius: 8 }}><ThemedText>{['작게', '기본', '크게'][i]}</ThemedText></Pressable>)}
  </View>{error ? <ThemedText accessibilityLiveRegion="polite">{error}</ThemedText> : null}</View>;
}
