import * as Clipboard from 'expo-clipboard';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ProjectForm } from '@/components/project-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useProjects } from '@/hooks/use-projects';
import { useRooms } from '@/hooks/use-rooms';
import { useTheme } from '@/hooks/use-theme';
import { formatDeadlineLabel, getDDayLabel } from '@/lib/deadline';
import type { Project, ProjectInput } from '@/types/project';
import { canManageRoom, canOwnRoom, type RoomInput, type RoomWithDetails } from '@/types/room';

type RoomFormProps = {
  room?: RoomWithDetails;
  submitLabel: string;
  isbusy?: boolean;
  error?: string;
  onSubmit: (input: RoomInput) => void | Promise<void>;
  onCancel: () => void;
};

function RoomForm({ room, submitLabel, isbusy = false, error, onSubmit, onCancel }: RoomFormProps) {
  const theme = useTheme();
  const [name, setName] = useState(room?.room.name ?? '');
  const [description, setDescription] = useState(room?.room.description ?? '');
  const [nameerror, setNameerror] = useState('');

  const inputStyle = [
    styles.input,
    {
      borderColor: theme.backgroundSelected,
      color: theme.text,
      backgroundColor: theme.background,
    },
  ];

  const handleSubmit = async () => {
    if (!name.trim()) {
      setNameerror('방 이름을 입력해 주세요.');
      return;
    }

    await onSubmit({ name, description, allowmemberinvite: room?.room.allowmemberinvite ?? true });
    setNameerror('');
  };

  return (
    <ThemedView type="backgroundElement" style={styles.form}>
      <View style={styles.field}>
        <ThemedText type="smallBold">방 이름</ThemedText>
        <TextInput
          value={name}
          editable={!isbusy}
          onChangeText={(value) => {
            setName(value);
            if (nameerror) {
              setNameerror('');
            }
          }}
          placeholder="예: SW final 4팀"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />
        {nameerror ? (
          <ThemedText type="small" style={styles.errorText}>
            {nameerror}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.field}>
        <ThemedText type="smallBold">설명</ThemedText>
        <TextInput
          value={description}
          editable={!isbusy}
          onChangeText={setDescription}
          multiline
          placeholder="팀 목표나 방 사용 목적을 적어 주세요."
          placeholderTextColor={theme.textSecondary}
          style={[inputStyle, styles.multilineInput]}
        />
      </View>

      {error ? (
        <ThemedText type="small" style={styles.errorText}>
          {error}
        </ThemedText>
      ) : null}

      <View style={styles.actions}>
        <Pressable disabled={isbusy} onPress={onCancel} style={({ pressed }) => [styles.secondaryButton, (pressed || isbusy) && styles.pressed]}>
          <ThemedText type="smallBold">취소</ThemedText>
        </Pressable>
        <Pressable disabled={isbusy} onPress={handleSubmit} style={({ pressed }) => [styles.primaryButton, (pressed || isbusy) && styles.pressed]}>
          {isbusy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              {submitLabel}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

function RoomProjectCard({ project }: { project: Project }) {
  return (
    <Pressable
      onPress={() => router.push(`/projects/${project.id}` as Href)}
      style={({ pressed }) => [styles.projectButton, pressed && styles.pressed]}>
      <View style={styles.projectTitleBlock}>
        <ThemedText type="smallBold" style={styles.projectTitle}>
          {project.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {project.description || '설명이 없습니다.'}
        </ThemedText>
      </View>
      <View style={styles.dDayPill}>
        <ThemedText type="smallBold" style={styles.dDayText}>
          {getDDayLabel(project.deadline)}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {formatDeadlineLabel(project.deadline)}
      </ThemedText>
    </Pressable>
  );
}

function InviteCodeCopyButton({ code }: { code: string }) {
  const [iscopied, setIscopied] = useState(false);

  const handleCopy = async () => {
    const didCopy = await Clipboard.setStringAsync(code);
    if (!didCopy) {
      return;
    }

    setIscopied(true);
    globalThis.setTimeout(() => setIscopied(false), 1600);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`초대코드 ${code} 복사`}
      onPress={handleCopy}
      style={({ pressed }) => [styles.codeCopyButton, pressed && styles.pressed]}>
      <ThemedText type="smallBold" style={styles.roomToggleText}>
        {iscopied ? '복사됨' : '복사'}
      </ThemedText>
    </Pressable>
  );
}

function RoomWorkspace({ roomid }: { roomid: string }) {
  const theme = useTheme();
  const { projects, isloadingprojects, projecterror, createProject } = useProjects(roomid);
  const [iscreateopen, setIscreateopen] = useState(false);
  const [iscreating, setIscreating] = useState(false);
  const [formerror, setFormerror] = useState('');

  const handleCreateProject = async (input: ProjectInput) => {
    setIscreating(true);
    setFormerror('');

    const result = await createProject(input);
    if (result.error) {
      setFormerror(result.error);
    } else {
      setIscreateopen(false);
    }

    setIscreating(false);
  };

  return (
    <View style={styles.workspace}>
      <View style={styles.workspaceHeader}>
        <View>
          <ThemedText type="smallBold">방 과제</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            이 방에서 공유할 과제를 만들고, 과제 안에서 아이디어를 작성합니다.
          </ThemedText>
        </View>
        <Pressable
          onPress={() => {
            setFormerror('');
            setIscreateopen(true);
          }}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            + 새 과제
          </ThemedText>
        </Pressable>
      </View>

      {projecterror ? (
        <ThemedText type="small" style={styles.errorText}>
          {projecterror}
        </ThemedText>
      ) : null}

      {isloadingprojects ? (
        <ThemedView type="backgroundElement" style={styles.emptyState}>
          <ActivityIndicator />
        </ThemedView>
      ) : projects.length === 0 ? (
        <ThemedView type="backgroundElement" style={styles.emptyState}>
          <ThemedText type="smallBold">아직 방 과제가 없습니다.</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
            과제를 만든 뒤 들어가면 팀원들과 같은 아이디어 보드를 보게 됩니다.
          </ThemedText>
        </ThemedView>
      ) : (
        <View style={styles.projectList}>
          {projects.map((project) => (
            <RoomProjectCard key={project.id} project={project} />
          ))}
        </View>
      )}

      <Modal visible={iscreateopen} transparent animationType="fade" onRequestClose={() => setIscreateopen(false)}>
        <View style={styles.modalOverlay}>
          <ThemedView style={[styles.modalPanel, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="smallBold" style={styles.modalTitle}>
                방 과제 만들기
              </ThemedText>
              <Pressable onPress={() => setIscreateopen(false)} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold">닫기</ThemedText>
              </Pressable>
            </View>
            <ProjectForm
              submitLabel="등록"
              isbusy={iscreating}
              error={formerror}
              onSubmit={handleCreateProject}
              onCancel={() => setIscreateopen(false)}
            />
          </ThemedView>
        </View>
      </Modal>
    </View>
  );
}

function RoomCard({
  item,
  isOpen,
  onToggle,
  onManage,
}: {
  item: RoomWithDetails;
  isOpen: boolean;
  onToggle: () => void;
  onManage: () => void;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.roomCard}>
      <View style={styles.roomCardHeader}>
        <View style={styles.roomTitleBlock}>
          <ThemedText type="smallBold" style={styles.roomTitle}>
            {item.room.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {item.room.description || '설명이 없습니다.'}
          </ThemedText>
        </View>
        <View style={styles.rolePill}>
          <ThemedText type="smallBold" style={styles.roleText}>
            {item.membership.role}
          </ThemedText>
        </View>
      </View>

      <View style={styles.metricRow}>
        <ThemedText type="small" themeColor="textSecondary">
          멤버 {item.members.length}명
        </ThemedText>
        <View style={styles.roomCodeRow}>
          <ThemedText type="small" themeColor="textSecondary">
            코드 {item.room.invitecode}
          </ThemedText>
          <InviteCodeCopyButton code={item.room.invitecode} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.room.name} 방 ${isOpen ? '접기' : '펼치기'}`}
            onPress={onToggle}
            style={({ pressed }) => [styles.roomToggleButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.roomToggleText}>
              {isOpen ? '접기' : '펼치기'}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {isOpen ? (
        <>
          <View style={styles.roomActions}>
            <Pressable onPress={onManage} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold">방 설정/멤버</ThemedText>
            </Pressable>
          </View>

          <RoomWorkspace roomid={item.room.id} />
        </>
      ) : null}
    </ThemedView>
  );
}

function RoomManager({
  item,
  isbusy,
  error,
  onClose,
  onUpdate,
  onDelete,
  onLeave,
  onChangeRole,
  onRemoveMember,
}: {
  item: RoomWithDetails;
  isbusy: boolean;
  error: string;
  onClose: () => void;
  onUpdate: (input: RoomInput) => Promise<void>;
  onDelete: () => Promise<void>;
  onLeave: () => Promise<void>;
  onChangeRole: (memberid: string, role: 'admin' | 'member') => Promise<void>;
  onRemoveMember: (memberid: string) => Promise<void>;
}) {
  const canManage = canManageRoom(item.membership.role);
  const canOwn = canOwnRoom(item.membership.role);

  return (
    <ScrollView contentContainerStyle={styles.managerContent}>
      <View style={styles.modalHeader}>
        <View style={styles.modalTitleBlock}>
          <ThemedText type="smallBold" style={styles.modalTitle}>
            {item.room.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            기본 초대코드 {item.room.invitecode}
          </ThemedText>
        </View>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold">닫기</ThemedText>
        </Pressable>
      </View>

      {canManage ? (
        <RoomForm room={item} submitLabel="설정 저장" isbusy={isbusy} error={error} onSubmit={onUpdate} onCancel={onClose} />
      ) : (
        <ThemedView type="backgroundElement" style={styles.infoPanel}>
          <ThemedText type="smallBold">멤버 권한</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            방 설정은 방장 또는 관리자만 변경할 수 있습니다.
          </ThemedText>
        </ThemedView>
      )}

      <ThemedView type="backgroundElement" style={styles.form}>
        <View style={styles.sectionHeader}>
          <ThemedText type="smallBold">초대코드</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            이 코드를 알려주면 누구나 코드 참가로 방에 들어올 수 있습니다.
          </ThemedText>
        </View>
        <View style={styles.codeBox}>
          <ThemedText type="subtitle" style={styles.codeText}>
            {item.room.invitecode}
          </ThemedText>
          <InviteCodeCopyButton code={item.room.invitecode} />
        </View>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.form}>
        <ThemedText type="smallBold">멤버</ThemedText>
        <View style={styles.list}>
          {item.members.map((member) => (
            <View key={member.id} style={styles.listItem}>
              <View style={styles.listItemCopy}>
                <ThemedText type="smallBold">{member.nickname || member.email || member.userid}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {member.role}
                </ThemedText>
              </View>
              {canOwn && member.role !== 'owner' ? (
                <View style={styles.memberActions}>
                  <Pressable
                    disabled={isbusy}
                    onPress={() => onChangeRole(member.id, member.role === 'admin' ? 'member' : 'admin')}
                    style={({ pressed }) => [styles.compactButton, (pressed || isbusy) && styles.pressed]}>
                    <ThemedText type="smallBold">{member.role === 'admin' ? '멤버로' : '관리자로'}</ThemedText>
                  </Pressable>
                  <Pressable
                    disabled={isbusy}
                    onPress={() => onRemoveMember(member.id)}
                    style={({ pressed }) => [styles.dangerButton, (pressed || isbusy) && styles.pressed]}>
                    <ThemedText type="smallBold" style={styles.primaryButtonText}>
                      내보내기
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ThemedView>

      {canOwn ? (
        <Pressable disabled={isbusy} onPress={onDelete} style={({ pressed }) => [styles.fullDangerButton, (pressed || isbusy) && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            방 삭제
          </ThemedText>
        </Pressable>
      ) : (
        <Pressable disabled={isbusy} onPress={onLeave} style={({ pressed }) => [styles.fullDangerButton, (pressed || isbusy) && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            방 나가기
          </ThemedText>
        </Pressable>
      )}
    </ScrollView>
  );
}

export function RoomPanel() {
  const theme = useTheme();
  const {
    rooms,
    isloadingrooms,
    roomerror,
    createRoom,
    updateRoom,
    deleteRoom,
    leaveRoom,
    joinRoomByCode,
    changeMemberRole,
    removeMember,
  } = useRooms();
  const [iscreateopen, setIscreateopen] = useState(false);
  const [isjoinopen, setIsjoinopen] = useState(false);
  const [selectedroomid, setSelectedroomid] = useState<string | null>(null);
  const [invitecode, setInvitecode] = useState('');
  const [isbusy, setIsbusy] = useState(false);
  const [mutationerror, setMutationerror] = useState('');
  const [openRoomIds, setOpenRoomIds] = useState<Record<string, boolean>>({});
  const [isRoomSectionOpen, setIsRoomSectionOpen] = useState(false);

  const selectedroom = useMemo(() => rooms.find((item) => item.room.id === selectedroomid), [rooms, selectedroomid]);
  const ownedCount = rooms.filter((item) => item.membership.role === 'owner').length;

  const runMutation = async (mutation: () => Promise<{ error?: string }>, onSuccess?: () => void) => {
    setIsbusy(true);
    setMutationerror('');

    const result = await mutation();
    if (result.error) {
      setMutationerror(result.error);
    } else {
      onSuccess?.();
    }

    setIsbusy(false);
  };

  const toggleRoom = (roomid: string) => {
    setOpenRoomIds((current) => ({ ...current, [roomid]: !current[roomid] }));
  };

  return (
    <ThemedView style={styles.panel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`내 방 섹션 ${isRoomSectionOpen ? '접기' : '펼치기'}`}
        onPress={() => setIsRoomSectionOpen((current) => !current)}
        style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}>
        <View style={styles.sectionCopy}>
          <ThemedText type="smallBold">내 방</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            방을 만들고 초대코드로 팀원을 불러 같은 과제와 아이디어 보드를 공유합니다.
          </ThemedText>
        </View>
        <View style={styles.sectionHeaderMeta}>
          <ThemedText type="small" themeColor="textSecondary">
            {rooms.length}개
          </ThemedText>
          <ThemedText type="smallBold" style={styles.roomToggleText}>
            {isRoomSectionOpen ? '접기' : '펼치기'}
          </ThemedText>
        </View>
      </Pressable>

      {isRoomSectionOpen ? (
        <>
          <View style={styles.headerActions}>
            <Pressable onPress={() => setIsjoinopen(true)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold">코드 참가</ThemedText>
            </Pressable>
            <Pressable onPress={() => setIscreateopen(true)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                방 만들기
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.summaryGrid}>
            <ThemedView type="backgroundElement" style={styles.summaryCard}>
              <ThemedText type="small" themeColor="textSecondary">
                참여 중
              </ThemedText>
              <ThemedText type="subtitle" style={styles.summaryValue}>
                {rooms.length}
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={styles.summaryCard}>
              <ThemedText type="small" themeColor="textSecondary">
                내가 방장
              </ThemedText>
              <ThemedText type="subtitle" style={styles.summaryValue}>
                {ownedCount}
              </ThemedText>
            </ThemedView>
          </View>

          {roomerror || mutationerror ? (
            <ThemedText type="small" style={styles.errorText}>
              {mutationerror || roomerror}
            </ThemedText>
          ) : null}

          {isloadingrooms ? (
            <ThemedView type="backgroundElement" style={styles.emptyState}>
              <ActivityIndicator />
            </ThemedView>
          ) : rooms.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyState}>
              <ThemedText type="smallBold">아직 참여 중인 방이 없습니다.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                먼저 방을 만들면 그 안에서 팀 과제와 아이디어를 만들 수 있습니다.
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.list}>
              {rooms.map((item) => (
                <RoomCard
                  key={item.room.id}
                  item={item}
                  isOpen={Boolean(openRoomIds[item.room.id])}
                  onToggle={() => toggleRoom(item.room.id)}
                  onManage={() => setSelectedroomid(item.room.id)}
                />
              ))}
            </View>
          )}
        </>
      ) : null}

      <Modal visible={iscreateopen} transparent animationType="fade" onRequestClose={() => setIscreateopen(false)}>
        <View style={styles.modalOverlay}>
          <ThemedView style={[styles.modalPanel, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="smallBold" style={styles.modalTitle}>
                방 만들기
              </ThemedText>
              <Pressable onPress={() => setIscreateopen(false)} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold">닫기</ThemedText>
              </Pressable>
            </View>
            <RoomForm
              submitLabel="생성"
              isbusy={isbusy}
              error={mutationerror}
              onSubmit={(input) => runMutation(() => createRoom(input), () => setIscreateopen(false))}
              onCancel={() => setIscreateopen(false)}
            />
          </ThemedView>
        </View>
      </Modal>

      <Modal visible={isjoinopen} transparent animationType="fade" onRequestClose={() => setIsjoinopen(false)}>
        <View style={styles.modalOverlay}>
          <ThemedView style={[styles.modalPanel, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="smallBold" style={styles.modalTitle}>
                초대코드로 참가
              </ThemedText>
              <Pressable onPress={() => setIsjoinopen(false)} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold">닫기</ThemedText>
              </Pressable>
            </View>
            <TextInput
              value={invitecode}
              editable={!isbusy}
              autoCapitalize="characters"
              onChangeText={setInvitecode}
              placeholder="초대코드"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                {
                  borderColor: theme.backgroundSelected,
                  color: theme.text,
                  backgroundColor: theme.background,
                },
              ]}
            />
            {mutationerror ? (
              <ThemedText type="small" style={styles.errorText}>
                {mutationerror}
              </ThemedText>
            ) : null}
            <View style={styles.actions}>
              <Pressable onPress={() => setIsjoinopen(false)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold">취소</ThemedText>
              </Pressable>
              <Pressable
                disabled={isbusy}
                onPress={() =>
                  runMutation(() => joinRoomByCode(invitecode), () => {
                    setInvitecode('');
                    setIsjoinopen(false);
                  })
                }
                style={({ pressed }) => [styles.primaryButton, (pressed || isbusy) && styles.pressed]}>
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  참가
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedroom)} transparent animationType="fade" onRequestClose={() => setSelectedroomid(null)}>
        <View style={styles.modalOverlay}>
          <ThemedView style={[styles.managerPanel, { backgroundColor: theme.background }]}>
            {selectedroom ? (
              <RoomManager
                item={selectedroom}
                isbusy={isbusy}
                error={mutationerror}
                onClose={() => setSelectedroomid(null)}
                onUpdate={(input) => runMutation(() => updateRoom(selectedroom.room.id, input))}
                onDelete={() => runMutation(() => deleteRoom(selectedroom.room.id), () => setSelectedroomid(null))}
                onLeave={() => runMutation(() => leaveRoom(selectedroom.room.id), () => setSelectedroomid(null))}
                onChangeRole={(memberid, role) => runMutation(() => changeMemberRole(selectedroom.room.id, memberid, role))}
                onRemoveMember={(memberid) => runMutation(() => removeMember(selectedroom.room.id, memberid))}
              />
            ) : null}
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  sectionCopy: {
    flex: 1,
    minWidth: 220,
    gap: Spacing.one,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  sectionHeaderMeta: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  summaryCard: {
    width: '48%',
    minHeight: 96,
    gap: Spacing.one,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
  },
  summaryValue: {
    color: '#2563eb',
  },
  list: {
    gap: Spacing.two,
  },
  roomCard: {
    gap: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
  },
  roomCardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  roomTitleBlock: {
    flex: 1,
    minWidth: 200,
    gap: Spacing.one,
  },
  roomTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  rolePill: {
    minHeight: 30,
    borderRadius: Spacing.two,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  roleText: {
    color: '#1d4ed8',
  },
  roomToggleText: {
    color: '#2563eb',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  roomCodeRow: {
    flexGrow: 1,
    minWidth: 220,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  roomToggleButton: {
    minHeight: 34,
    marginLeft: 'auto',
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  roomActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  workspace: {
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: Spacing.three,
  },
  workspaceHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  projectList: {
    gap: Spacing.two,
  },
  projectButton: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: Spacing.two,
  },
  projectTitleBlock: {
    flex: 1,
    minWidth: 180,
    gap: Spacing.one,
  },
  projectTitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  dDayPill: {
    minHeight: 30,
    borderRadius: Spacing.two,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  dDayText: {
    color: '#1d4ed8',
  },
  form: {
    gap: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: Spacing.two,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  codeBox: {
    minHeight: 56,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  codeText: {
    color: '#1d4ed8',
    letterSpacing: 1,
  },
  codeCopyButton: {
    minHeight: 34,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  listItem: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#f8fafc',
    padding: Spacing.two,
  },
  listItemCopy: {
    flex: 1,
    minWidth: 180,
    gap: Spacing.one,
  },
  memberActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: Spacing.two,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  compactButton: {
    minHeight: 36,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  dangerButton: {
    minHeight: 36,
    borderRadius: Spacing.two,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  fullDangerButton: {
    minHeight: 44,
    borderRadius: Spacing.two,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  closeButton: {
    minHeight: 36,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: Spacing.three,
  },
  modalPanel: {
    width: '100%',
    maxWidth: 560,
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  managerPanel: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '92%',
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  managerContent: {
    gap: Spacing.three,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  modalTitleBlock: {
    flex: 1,
    gap: Spacing.one,
  },
  modalTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  infoPanel: {
    gap: Spacing.one,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.four,
  },
  emptyText: {
    textAlign: 'center',
  },
  errorText: {
    color: '#dc2626',
  },
  pressed: {
    opacity: 0.72,
  },
});
