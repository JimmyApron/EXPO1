import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { ProjectForm } from '@/components/project-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Project, ProjectInput } from '@/types/project';

type ProjectEditModalProps = {
  visible: boolean;
  project: Project;
  isBusy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: ProjectInput) => boolean | Promise<boolean>;
};

export function ProjectEditModal({ visible, project, isBusy, error, onClose, onSubmit }: ProjectEditModalProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <ThemedView type="surfaceElevated" style={[styles.panel, { borderColor: theme.border }, Shadows.floating]}>
          {visible ? <>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <ThemedText type="sectionTitle">과제 수정</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">과제 정보를 변경할 수 있어요.</ThemedText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="과제 수정 창 닫기" onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
                <AppIcon name="close" color={theme.textSecondary} size={22} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
              <ProjectForm key={`${project.id}:${project.updatedat ?? ''}`} project={project} submitLabel="저장" isbusy={isBusy} error={error} onSubmit={onSubmit} onCancel={onClose} />
            </ScrollView>
          </> : null}
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  panel: { width: '100%', maxWidth: 640, maxHeight: '92%', borderWidth: 1, borderTopLeftRadius: Radius.xlarge, borderTopRightRadius: Radius.xlarge, padding: Spacing.three, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  headerCopy: { flex: 1, gap: Spacing.one },
  close: { width: ControlHeight.touch, height: ControlHeight.touch, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  pressed: { opacity: 0.7 },
});
