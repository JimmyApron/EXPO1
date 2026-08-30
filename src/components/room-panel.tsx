import * as Clipboard from 'expo-clipboard';
import { router, type Href } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { ProjectForm } from '@/components/project-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useProjects } from '@/hooks/use-projects';
import { useRooms } from '@/hooks/use-rooms';
import { useTheme } from '@/hooks/use-theme';
import { formatDeadlineLabel, getDDayLabel } from '@/lib/deadline';
import type { Project, ProjectInput } from '@/types/project';
import {
  canManageRoom,
  canOwnRoom,
  type RoomInput,
  type RoomMember,
  type RoomRole,
  type RoomWithDetails,
} from '@/types/room';

const roomRoleLabels: Record<RoomRole, string> = {
  owner: '방장',
  member: '멤버',
};

function getMemberLabel(member: Pick<RoomMember, 'nickname' | 'email' | 'userid'>) {
  return member.nickname || member.email || member.userid;
}

type Confirmation =
  | { kind: 'transfer'; member: RoomMember }
  | { kind: 'kick'; member: RoomMember };

function ConfirmationModal({
  confirmation,
  isbusy,
  error,
  onCancel,
  onConfirm,
}: {
  confirmation: Confirmation | null;
  isbusy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const theme = useTheme();
  if (!confirmation) {
    return null;
  }

  const target = getMemberLabel(confirmation.member);
  const isDanger = confirmation.kind === 'kick';
  const title = confirmation.kind === 'transfer'
    ? '방장 권한을 위임할까요?'
    : '멤버를 강퇴할까요?';
  const confirmLabel = confirmation.kind === 'transfer'
    ? '방장 위임'
    : '강퇴';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
        <ThemedView
          type="surfaceElevated"
          accessibilityRole="alert"
          style={[styles.confirmPanel, { borderColor: isDanger ? theme.danger : theme.border }, Shadows.floating]}>
          <ThemedText type="smallBold" style={styles.modalTitle}>{title}</ThemedText>
          <ThemedText type="smallBold">대상: {target}</ThemedText>
          {confirmation.kind === 'transfer' ? (
            <View style={styles.confirmCopy}>
              <ThemedText type="small" themeColor="textSecondary">
                위임 후 취소하려면 새 방장의 협조가 필요합니다.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                현재 방장은 위임이 완료되면 일반 멤버로 변경됩니다.
              </ThemedText>
            </View>
          ) : (
            <ThemedText type="small" style={styles.errorText}>
              {target} 님을 방에서 내보냅니다. 이후 초대코드로 다시 참가할 수 있습니다.
            </ThemedText>
          )}
          {error ? <ThemedText type="small" style={styles.errorText}>{error}</ThemedText> : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${title} 취소`}
              disabled={isbusy}
              onPress={onCancel}
              style={({ pressed }) => [styles.secondaryButton, (pressed || isbusy) && styles.disabledButton]}>
              <ThemedText type="smallBold">취소</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${target} ${confirmLabel}`}
              disabled={isbusy}
              onPress={onConfirm}
              style={({ pressed }) => [
                isDanger ? styles.dangerButton : styles.primaryButton,
                (pressed || isbusy) && styles.disabledButton,
              ]}>
              {isbusy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <ThemedText type="smallBold" style={styles.primaryButtonText}>{confirmLabel}</ThemedText>
              )}
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

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
        {!room ? (
          <Pressable disabled={isbusy} onPress={onCancel} style={({ pressed }) => [styles.secondaryButton, (pressed || isbusy) && styles.pressed]}>
            <ThemedText type="smallBold">취소</ThemedText>
          </Pressable>
        ) : null}
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
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.push(`/projects/${project.id}` as Href)}
      style={({ pressed }) => [
        styles.projectButton,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.projectTitleBlock}>
        <ThemedText type="smallBold" style={styles.projectTitle}>
          {project.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {project.description || '설명이 없습니다.'}
        </ThemedText>
      </View>
      <View style={[styles.dDayPill, { backgroundColor: theme.warningSoft }]}>
        <ThemedText type="smallBold" style={[styles.dDayText, { color: theme.warning }]}>
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
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <ThemedView
            type="surfaceElevated"
            style={[styles.modalPanel, { borderColor: theme.border }, Shadows.floating]}>
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
  const theme = useTheme();
  const roleLabel = roomRoleLabels[item.membership.role];
  const isManager = canManageRoom(item.membership.role);

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.roomCard, { borderColor: theme.border }, Shadows.card]}>
      <View style={styles.roomCardHeader}>
        <View style={styles.roomTitleBlock}>
          <ThemedText type="smallBold" style={styles.roomTitle}>
            {item.room.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {item.room.description || '설명이 없습니다.'}
          </ThemedText>
        </View>
        <View
          accessibilityLabel={`내 역할 ${roleLabel}`}
          style={[styles.roleInfo, { borderLeftColor: isManager ? theme.primary : theme.border }]}>
          <ThemedText type="caption" themeColor="textTertiary">
            내 역할
          </ThemedText>
          <ThemedText
            type="captionStrong"
            style={{ color: isManager ? theme.primary : theme.textSecondary }}>
            {roleLabel}
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
            style={({ pressed }) => [
              styles.roomToggleButton,
              { borderColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={[styles.roomToggleText, { color: theme.primary }]}>
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
  success,
  onClose,
  onUpdate,
  onDelete,
  onLeave,
  onTransferOwnership,
  onKickMember,
  onBeginAction,
}: {
  item: RoomWithDetails;
  isbusy: boolean;
  error: string;
  success: string;
  onClose: () => void;
  onUpdate: (input: RoomInput) => Promise<void>;
  onDelete: () => Promise<void>;
  onLeave: () => Promise<void>;
  onTransferOwnership: (memberid: string) => Promise<{ error?: string }>;
  onKickMember: (memberid: string) => Promise<{ error?: string }>;
  onBeginAction: () => void;
}) {
  const theme = useTheme();
  const canManage = canManageRoom(item.membership.role);
  const canOwn = canOwnRoom(item.membership.role);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busykey, setBusykey] = useState('');
  const busyref = useRef(false);
  const isactiondisabled = isbusy || Boolean(busykey);

  const startConfirmation = (nextConfirmation: Confirmation) => {
    onBeginAction();
    setConfirmation(nextConfirmation);
  };

  const runMemberAction = async (
    key: string,
    mutation: () => Promise<{ error?: string }>,
    closeConfirmation = false,
  ) => {
    if (busyref.current || isbusy) {
      return;
    }
    busyref.current = true;
    setBusykey(key);
    const result = await mutation();
    busyref.current = false;
    setBusykey('');
    if (!result.error && closeConfirmation) {
      setConfirmation(null);
    }
  };

  const handleConfirmedAction = async () => {
    if (!confirmation) {
      return;
    }
    if (confirmation.kind === 'transfer') {
      await runMemberAction(
        `transfer:${confirmation.member.id}`,
        () => onTransferOwnership(confirmation.member.id),
        true,
      );
      return;
    }
    await runMemberAction(
      `kick:${confirmation.member.id}`,
      () => onKickMember(confirmation.member.id),
      true,
    );
  };

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="방 관리 화면 닫기"
          disabled={isactiondisabled}
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, (pressed || isactiondisabled) && styles.disabledButton]}>
          <ThemedText type="smallBold">닫기</ThemedText>
        </Pressable>
      </View>

      {success ? <ThemedText type="small" style={styles.successText}>{success}</ThemedText> : null}
      {error ? <ThemedText type="small" style={styles.errorText}>{error}</ThemedText> : null}

      {canManage ? (
        <RoomForm room={item} submitLabel="설정 저장" isbusy={isbusy} error={error} onSubmit={onUpdate} onCancel={onClose} />
      ) : (
        <ThemedView type="backgroundElement" style={styles.infoPanel}>
          <ThemedText type="smallBold">멤버 권한</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            방 설정은 방장만 변경할 수 있습니다.
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
        <View style={styles.memberSectionHeader}>
          <ThemedText type="smallBold">멤버</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            방장은 한 명이며, 방장 권한을 넘기면 기존 방장은 일반 멤버가 됩니다.
          </ThemedText>
        </View>
        <View style={styles.list}>
          {item.members.map((member) => (
            <View
              key={member.id}
              style={[
                styles.listItem,
                styles.memberCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <View style={styles.memberIdentity}>
                <View style={styles.listItemCopy}>
                <ThemedText type="smallBold">{getMemberLabel(member)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {member.email || member.userid}
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.memberRoleBadge,
                    { backgroundColor: member.role === 'owner' ? theme.primarySoft : theme.backgroundSelected },
                  ]}>
                  <ThemedText
                    type="captionStrong"
                    style={{ color: member.role === 'owner' ? theme.primary : theme.textSecondary }}>
                    {roomRoleLabels[member.role]}
                  </ThemedText>
                </View>
              </View>
              {canOwn && item.members.length > 1 && member.role !== 'owner' ? (
                <View style={[styles.memberActions, { borderTopColor: theme.divider }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${getMemberLabel(member)}에게 방장 위임`}
                    disabled={isactiondisabled}
                    onPress={() => startConfirmation({ kind: 'transfer', member })}
                    style={({ pressed }) => [styles.primaryButton, styles.memberActionButton, (pressed || isactiondisabled) && styles.disabledButton]}>
                    {busykey === `transfer:${member.id}` ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <ThemedText type="smallBold" style={styles.primaryButtonText}>방장 권한 넘기기</ThemedText>
                    )}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${getMemberLabel(member)} 강퇴`}
                    disabled={isactiondisabled}
                    onPress={() => startConfirmation({ kind: 'kick', member })}
                    style={({ pressed }) => [styles.dangerButton, styles.memberActionButton, (pressed || isactiondisabled) && styles.disabledButton]}>
                    {busykey === `kick:${member.id}` ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <ThemedText type="smallBold" style={styles.primaryButtonText}>강퇴</ThemedText>
                    )}
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ThemedView>

      {canOwn ? (
        <Pressable disabled={isactiondisabled} onPress={onDelete} style={({ pressed }) => [styles.fullDangerButton, (pressed || isactiondisabled) && styles.disabledButton]}>
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            방 삭제
          </ThemedText>
        </Pressable>
      ) : (
        <Pressable disabled={isactiondisabled} onPress={onLeave} style={({ pressed }) => [styles.fullDangerButton, (pressed || isactiondisabled) && styles.disabledButton]}>
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            방 나가기
          </ThemedText>
        </Pressable>
      )}

      <ConfirmationModal
        confirmation={confirmation}
        isbusy={Boolean(busykey)}
        error={error}
        onCancel={() => {
          if (!busykey) {
            setConfirmation(null);
          }
        }}
        onConfirm={handleConfirmedAction}
      />
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
    transferRoomOwnership,
    kickRoomMember,
  } = useRooms();
  const [iscreateopen, setIscreateopen] = useState(false);
  const [isjoinopen, setIsjoinopen] = useState(false);
  const [selectedroomid, setSelectedroomid] = useState<string | null>(null);
  const [invitecode, setInvitecode] = useState('');
  const [isbusy, setIsbusy] = useState(false);
  const [mutationerror, setMutationerror] = useState('');
  const [mutationsuccess, setMutationsuccess] = useState('');
  const mutationref = useRef(false);
  const [openRoomIds, setOpenRoomIds] = useState<Record<string, boolean>>({});
  const [isRoomSectionOpen, setIsRoomSectionOpen] = useState(true);

  const selectedroom = useMemo(() => rooms.find((item) => item.room.id === selectedroomid), [rooms, selectedroomid]);
  const ownedCount = rooms.filter((item) => item.membership.role === 'owner').length;

  const runMutation = async (
    mutation: () => Promise<{ error?: string }>,
    onSuccess?: () => void,
    successMessage = '',
  ) => {
    if (mutationref.current) {
      return { error: '요청을 처리 중입니다. 잠시만 기다려 주세요.' };
    }
    mutationref.current = true;
    setIsbusy(true);
    setMutationerror('');
    setMutationsuccess('');

    let result: { error?: string };
    try {
      result = await mutation();
    } catch {
      result = { error: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.' };
    }
    if (result.error) {
      setMutationerror(result.error);
    } else {
      setMutationsuccess(successMessage);
      onSuccess?.();
    }

    setIsbusy(false);
    mutationref.current = false;
    return result;
  };

  const runMemberMutation = async (
    mutation: () => Promise<{ error?: string }>,
    successMessage: string,
  ) => {
    setMutationerror('');
    setMutationsuccess('');
    let result: { error?: string };
    try {
      result = await mutation();
    } catch {
      result = { error: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.' };
    }
    if (result.error) {
      setMutationerror(result.error);
    } else {
      setMutationsuccess(successMessage);
    }
    return result;
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
            <ThemedView
              type="backgroundElement"
              style={[styles.summaryCard, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                참여 중
              </ThemedText>
              <ThemedText type="subtitle" style={[styles.summaryValue, { color: theme.primary }]}>
                {rooms.length}
              </ThemedText>
            </ThemedView>
            <ThemedView
              type="backgroundElement"
              style={[styles.summaryCard, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                내가 방장
              </ThemedText>
              <ThemedText type="subtitle" style={[styles.summaryValue, { color: theme.primary }]}>
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
            <LoadingSkeleton rows={2} />
          ) : rooms.length === 0 ? (
            <EmptyState
              icon="rooms"
              title="아직 참여 중인 방이 없어요"
              description="방을 만들거나 초대 코드로 참가해 팀원과 함께 작업하세요."
              actionLabel="방 만들기"
              onAction={() => setIscreateopen(true)}
            />
          ) : (
            <View style={styles.list}>
              {rooms.map((item) => (
                <RoomCard
                  key={item.room.id}
                  item={item}
                  isOpen={Boolean(openRoomIds[item.room.id])}
                  onToggle={() => toggleRoom(item.room.id)}
                  onManage={() => {
                    setMutationerror('');
                    setMutationsuccess('');
                    setSelectedroomid(item.room.id);
                  }}
                />
              ))}
            </View>
          )}
        </>
      ) : null}

      <Modal visible={iscreateopen} transparent animationType="fade" onRequestClose={() => setIscreateopen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <ThemedView
            type="surfaceElevated"
            style={[styles.modalPanel, { borderColor: theme.border }, Shadows.floating]}>
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
              onSubmit={(input) => runMutation(
                () => createRoom(input),
                () => setIscreateopen(false),
                '방을 만들었습니다.',
              ).then(() => undefined)}
              onCancel={() => setIscreateopen(false)}
            />
          </ThemedView>
        </View>
      </Modal>

      <Modal visible={isjoinopen} transparent animationType="fade" onRequestClose={() => setIsjoinopen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <ThemedView
            type="surfaceElevated"
            style={[styles.modalPanel, { borderColor: theme.border }, Shadows.floating]}>
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
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <ThemedView
            type="surfaceElevated"
            style={[styles.managerPanel, { borderColor: theme.border }, Shadows.floating]}>
            {selectedroom ? (
              <RoomManager
                item={selectedroom}
                isbusy={isbusy}
                error={mutationerror}
                success={mutationsuccess}
                onClose={() => setSelectedroomid(null)}
                onUpdate={(input) => runMutation(
                  () => updateRoom(selectedroom.room.id, input),
                  undefined,
                  '방 설정을 저장했습니다.',
                ).then(() => undefined)}
                onDelete={() => runMutation(
                  () => deleteRoom(selectedroom.room.id),
                  () => setSelectedroomid(null),
                  '방을 삭제했습니다.',
                ).then(() => undefined)}
                onLeave={() => runMutation(
                  () => leaveRoom(selectedroom.room.id),
                  () => setSelectedroomid(null),
                  '방에서 나갔습니다.',
                ).then(() => undefined)}
                onTransferOwnership={(memberid) => runMemberMutation(
                  () => transferRoomOwnership(selectedroom.room.id, memberid),
                  '방장 위임이 완료되었습니다. 기존 방장은 일반 멤버로 변경되었습니다.',
                )}
                onKickMember={(memberid) => runMemberMutation(
                  () => kickRoomMember(selectedroom.room.id, memberid),
                  '멤버를 방에서 강퇴했습니다.',
                )}
                onBeginAction={() => {
                  setMutationerror('');
                  setMutationsuccess('');
                }}
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
    gap: Spacing.four,
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
    flexGrow: 1,
    flexBasis: 220,
    minHeight: 88,
    gap: Spacing.one,
    borderRadius: Radius.large,
    borderWidth: 1,
    padding: Spacing.three,
  },
  summaryValue: {
    fontSize: 24,
    lineHeight: 30,
  },
  list: {
    gap: Spacing.two,
  },
  roomCard: {
    gap: Spacing.four,
    borderRadius: Radius.large,
    borderWidth: 1,
    padding: Spacing.four,
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
  roleInfo: {
    minWidth: 64,
    alignSelf: 'flex-start',
    gap: Spacing.half,
    borderLeftWidth: 2,
    paddingLeft: Spacing.two,
  },
  roomToggleText: {
    color: '#F59E0B',
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
    minHeight: ControlHeight.touch,
    marginLeft: 'auto',
    borderRadius: Radius.medium,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  roomActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  workspace: {
    gap: Spacing.three,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  projectButton: {
    flexGrow: 1,
    flexBasis: 300,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: 1,
    padding: Spacing.three,
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
    borderRadius: Radius.pill,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  dDayText: {
    color: '#D97706',
  },
  form: {
    gap: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: 1,
    padding: Spacing.three,
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    minHeight: ControlHeight.input,
    borderWidth: 1,
    borderRadius: Radius.medium,
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
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  codeText: {
    color: '#D97706',
    letterSpacing: 1,
  },
  codeCopyButton: {
    minHeight: ControlHeight.touch,
    borderRadius: Radius.medium,
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
    borderRadius: Radius.medium,
    padding: Spacing.two,
  },
  listItemCopy: {
    flex: 1,
    minWidth: 180,
    gap: Spacing.one,
  },
  memberSectionHeader: {
    gap: Spacing.one,
  },
  memberCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
  },
  memberIdentity: {
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  memberRoleBadge: {
    minHeight: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  memberActions: {
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: Spacing.two,
    borderTopWidth: 1,
    paddingTop: Spacing.three,
  },
  memberActionButton: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: ControlHeight.touch,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  primaryButton: {
    minHeight: ControlHeight.button,
    borderRadius: Radius.medium,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  secondaryButton: {
    minHeight: ControlHeight.touch,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  compactButton: {
    minHeight: ControlHeight.touch,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  dangerButton: {
    minHeight: ControlHeight.touch,
    borderRadius: Radius.medium,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  fullDangerButton: {
    minHeight: ControlHeight.button,
    borderRadius: Radius.medium,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  closeButton: {
    minHeight: ControlHeight.touch,
    borderRadius: Radius.medium,
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
    padding: Spacing.three,
  },
  modalPanel: {
    width: '100%',
    maxWidth: 560,
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.four,
  },
  confirmPanel: {
    width: '100%',
    maxWidth: 520,
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.four,
  },
  confirmCopy: {
    gap: Spacing.one,
  },
  managerPanel: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '92%',
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.four,
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
    borderRadius: Radius.large,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.large,
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
  successText: {
    color: '#15803d',
  },
  pressed: {
    opacity: 0.72,
  },
  disabledButton: {
    opacity: 0.56,
  },
});
