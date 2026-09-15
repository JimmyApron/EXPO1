import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { supabase } from '@/lib/supabase';
import {
  canManageRoom,
  canOwnRoom,
  normalizeRoomRole,
  type Room,
  type RoomInput,
  type RoomMember,
  type RoomWithDetails,
} from '@/types/room';

type RoomMutationResult = {
  room?: RoomWithDetails;
  error?: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  nickname: string | null;
};

const roomSelect = 'id, ownerid, name, description, invitecode, allowmemberinvite, createdat, updatedat';
const memberSelect = 'id, roomid, userid, role, createdat, updatedat';
const roomRealtimeTables = ['rooms', 'roommembers'] as const;
const missingSchemaMessage =
  '방 기능 DB 마이그레이션이 아직 Supabase에 적용되지 않았습니다. 프로젝트 루트에서 npx supabase db push를 실행해 주세요.';

function cleanRoomInput(input: RoomInput) {
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    allowmemberinvite: input.allowmemberinvite,
  };
}

function validateRoomInput(input: RoomInput) {
  if (!input.name.trim()) {
    return '방 이름을 입력해 주세요.';
  }

  return '';
}

function getRoomErrorMessage(error: { message?: string; code?: string } | null) {
  if (!error) {
    return '';
  }

  const message = error.message ?? '';
  if (
    error.code === 'PGRST205' ||
    message.includes('schema cache') ||
    message.includes("Could not find the function") ||
    message.includes('does not exist')
  ) {
    return missingSchemaMessage;
  }

  if (
    error.code === '401' ||
    message.includes('JWT') ||
    message.toLowerCase().includes('session')
  ) {
    return '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  }

  if (
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('fetch') ||
    message.toLowerCase().includes('connection')
  ) {
    return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
  }

  return message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

function normalizeRoom(row: Partial<Room>): Room {
  return {
    id: row.id ?? '',
    ownerid: row.ownerid ?? '',
    name: row.name ?? '',
    description: row.description ?? '',
    invitecode: row.invitecode ?? '',
    allowmemberinvite: row.allowmemberinvite !== false,
    createdat: row.createdat ?? '',
    updatedat: row.updatedat ?? '',
  };
}

function normalizeMember(row: Partial<RoomMember>, profiles: Map<string, ProfileRow>): RoomMember {
  const userid = row.userid ?? '';
  const profile = profiles.get(userid);

  return {
    id: row.id ?? '',
    roomid: row.roomid ?? '',
    userid,
    role: normalizeRoomRole(row.role),
    email: profile?.email ?? null,
    nickname: profile?.nickname ?? null,
    createdat: row.createdat ?? '',
    updatedat: row.updatedat ?? '',
  };
}

function buildRoomDetails(
  userId: string,
  rooms: Room[],
  members: RoomMember[],
) {
  const membersByRoomId = new Map<string, RoomMember[]>();

  members.forEach((member) => {
    const current = membersByRoomId.get(member.roomid) ?? [];
    current.push(member);
    membersByRoomId.set(member.roomid, current);
  });

  return rooms
    .map((room) => {
      const roomMembers = membersByRoomId.get(room.id) ?? [];
      const membership = roomMembers.find((member) => member.userid === userId);

      if (!membership) {
        return null;
      }

      return {
        room,
        membership,
        members: roomMembers,
        invites: [],
      };
    })
    .filter(Boolean) as RoomWithDetails[];
}

export function useRooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<RoomWithDetails[]>([]);
  const [isloadingrooms, setIsloadingrooms] = useState(true);
  const [roomerror, setRoomerror] = useState('');

  const roomById = useMemo(() => new Map(rooms.map((item) => [item.room.id, item])), [rooms]);

  const loadRooms = useCallback(async () => {
    if (!user) {
      setRooms([]);
      setIsloadingrooms(false);
      return [];
    }

    setIsloadingrooms(true);
    setRoomerror('');

    const { data: myMembershipRows, error: membershipError } = await supabase
      .from('roommembers')
      .select(memberSelect)
      .eq('userid', user.id);

    if (membershipError) {
      setRoomerror(getRoomErrorMessage(membershipError));
      setRooms([]);
      setIsloadingrooms(false);
      return null;
    }

    const roomIds = Array.from(
      new Set((myMembershipRows ?? []).map((row) => String(row.roomid)).filter(Boolean)),
    );

    if (roomIds.length === 0) {
      setRooms([]);
      setIsloadingrooms(false);
      return [];
    }

    const [{ data: roomRows, error: roomsError }, { data: memberRows, error: membersError }] =
      await Promise.all([
        supabase.from('rooms').select(roomSelect).in('id', roomIds).order('createdat', { ascending: false }),
        supabase.from('roommembers').select(memberSelect).in('roomid', roomIds).order('createdat', { ascending: true }),
      ]);

    const firstError = roomsError || membersError;
    if (firstError) {
      setRoomerror(getRoomErrorMessage(firstError));
      setRooms([]);
      setIsloadingrooms(false);
      return null;
    }

    const memberUserIds = Array.from(
      new Set((memberRows ?? []).map((row) => String(row.userid)).filter(Boolean)),
    );
    const profiles = new Map<string, ProfileRow>();

    if (memberUserIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, email, nickname')
        .in('id', memberUserIds);

      (profileRows ?? []).forEach((profile) => {
        profiles.set(String(profile.id), profile as ProfileRow);
      });
    }

    const normalizedRooms = (roomRows ?? []).map((row) => normalizeRoom(row as Partial<Room>));
    const normalizedMembers = (memberRows ?? []).map((row) =>
      normalizeMember(row as Partial<RoomMember>, profiles),
    );

    const nextRooms = buildRoomDetails(user.id, normalizedRooms, normalizedMembers);
    setRooms(nextRooms);
    setIsloadingrooms(false);
    return nextRooms;
  }, [user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      loadRooms();
    }, 0);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [loadRooms]);

  useRealtimeRefresh({
    channelName: `rooms:${user?.id ?? 'signed-out'}`,
    enabled: Boolean(user),
    onRefresh: loadRooms,
    tables: roomRealtimeTables,
  });

  const createRoom = useCallback(
    async (input: RoomInput): Promise<RoomMutationResult> => {
      if (!user) {
        return { error: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.' };
      }

      const validationerror = validateRoomInput(input);
      if (validationerror) {
        return { error: validationerror };
      }

      const cleaned = cleanRoomInput(input);
      const { data, error } = await supabase.rpc('create_room', {
        p_name: cleaned.name,
        p_description: cleaned.description,
        p_allowmemberinvite: cleaned.allowmemberinvite,
      });
      const nextRooms = await loadRooms();
      const nextRoom = nextRooms?.find((item) => item.room.id === data);
      if (error && !nextRoom) {
        return { error: getRoomErrorMessage(error) };
      }
      return { room: nextRoom };
    },
    [loadRooms, user],
  );

  const updateRoom = useCallback(
    async (roomid: string, input: RoomInput): Promise<RoomMutationResult> => {
      if (!user) {
        return { error: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.' };
      }

      const current = roomById.get(roomid);
      if (!current || !canManageRoom(current.membership.role)) {
        return { error: '방 설정을 바꿀 권한이 없습니다.' };
      }

      const validationerror = validateRoomInput(input);
      if (validationerror) {
        return { error: validationerror };
      }

      const cleaned = cleanRoomInput(input);
      const { error } = await supabase.rpc('update_room', {
        p_roomid: roomid,
        p_name: cleaned.name,
        p_description: cleaned.description,
        p_allowmemberinvite: cleaned.allowmemberinvite,
      });
      const nextRooms = await loadRooms();
      const nextRoom = nextRooms?.find((item) => item.room.id === roomid);
      const wasApplied = nextRoom?.room.name === cleaned.name
        && nextRoom.room.description === cleaned.description
        && nextRoom.room.allowmemberinvite === cleaned.allowmemberinvite;
      if (error && !wasApplied) {
        return { error: getRoomErrorMessage(error) };
      }
      return { room: nextRoom };
    },
    [loadRooms, roomById, user],
  );

  const deleteRoom = useCallback(
    async (roomid: string) => {
      if (!user) {
        return { error: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.' };
      }

      const current = roomById.get(roomid);
      if (!current || !canOwnRoom(current.membership.role)) {
        return { error: '방장만 방을 삭제할 수 있습니다.' };
      }

      const { error } = await supabase.rpc('delete_room', { p_roomid: roomid });
      const nextRooms = await loadRooms();
      if (error && nextRooms?.some((item) => item.room.id === roomid)) {
        return { error: getRoomErrorMessage(error) };
      }
      return {};
    },
    [loadRooms, roomById, user],
  );

  const leaveRoom = useCallback(
    async (roomid: string) => {
      if (!user) {
        return { error: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.' };
      }

      const current = roomById.get(roomid);
      if (!current) {
        return { error: '방을 찾을 수 없습니다.' };
      }

      if (canOwnRoom(current.membership.role)) {
        return {
          error: current.members.length > 1
            ? '다른 멤버가 있어 방을 나갈 수 없습니다. 먼저 방장을 위임해 주세요.'
            : '방장 혼자 남은 방은 나갈 수 없습니다. 방 삭제를 이용해 주세요.',
        };
      }

      const { error } = await supabase.rpc('leave_room', { p_roomid: roomid });
      const nextRooms = await loadRooms();
      if (error && nextRooms?.some((item) => item.room.id === roomid)) {
        return { error: getRoomErrorMessage(error) };
      }
      return {};
    },
    [loadRooms, roomById, user],
  );

  const joinRoomByCode = useCallback(
    async (rawCode: string) => {
      if (!user) {
        return { error: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.' };
      }

      const code = rawCode.trim().toUpperCase();
      if (!code) {
        return { error: '초대코드를 입력해 주세요.' };
      }

      const { data, error } = await supabase.rpc('join_room_by_code', { p_code: code });
      const nextRooms = await loadRooms();
      const joined = nextRooms?.some(
        (item) => item.room.id === data || item.room.invitecode === code,
      );
      if (error && !joined) {
        return { error: getRoomErrorMessage(error) };
      }
      return {};
    },
    [loadRooms, user],
  );

  const transferRoomOwnership = useCallback(
    async (roomid: string, memberid: string) => {
      const current = roomById.get(roomid);
      if (!current || !canOwnRoom(current.membership.role)) {
        return { error: '더 이상 방장이 아닙니다. 방 정보를 새로고침해 주세요.' };
      }
      const target = current.members.find((member) => member.id === memberid);
      if (!target) {
        return { error: '대상 사용자가 이미 방을 나갔거나 강퇴되었습니다.' };
      }

      const { error } = await supabase.rpc('transfer_room_ownership', {
        p_roomid: roomid,
        p_target_memberid: memberid,
      });
      const nextRooms = await loadRooms();
      const wasApplied = nextRooms
        ?.find((item) => item.room.id === roomid)
        ?.room.ownerid === target.userid;
      if (error && !wasApplied) {
        return { error: getRoomErrorMessage(error) };
      }
      return {};
    },
    [loadRooms, roomById],
  );

  const kickRoomMember = useCallback(
    async (roomid: string, memberid: string) => {
      const current = roomById.get(roomid);
      if (!current || !canOwnRoom(current.membership.role)) {
        return { error: '방장만 멤버를 강퇴할 수 있습니다.' };
      }
      const target = current.members.find((member) => member.id === memberid);
      if (!target) {
        return { error: '대상 사용자가 이미 방을 나갔거나 강퇴되었습니다.' };
      }

      const { error } = await supabase.rpc('kick_room_member', {
        p_roomid: roomid,
        p_target_memberid: memberid,
      });
      const nextRooms = await loadRooms();
      const memberGone = !nextRooms
        ?.find((item) => item.room.id === roomid)
        ?.members.some((member) => member.id === memberid);
      if (error && !memberGone) {
        return { error: getRoomErrorMessage(error) };
      }
      return {};
    },
    [loadRooms, roomById],
  );

  return {
    rooms,
    isloadingrooms,
    roomerror,
    loadRooms,
    createRoom,
    updateRoom,
    deleteRoom,
    leaveRoom,
    joinRoomByCode,
    transferRoomOwnership,
    kickRoomMember,
  };
}
