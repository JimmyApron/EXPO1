import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import {
  canManageRoom,
  canOwnRoom,
  normalizeRoomRole,
  type Room,
  type RoomInput,
  type RoomInvite,
  type RoomMember,
  type RoomWithDetails,
} from '@/types/room';

type RoomMutationResult = {
  room?: RoomWithDetails;
  invite?: RoomInvite;
  error?: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  nickname: string | null;
};

const roomSelect = 'id, ownerid, name, description, invitecode, allowmemberinvite, createdat, updatedat';
const memberSelect = 'id, roomid, userid, role, createdat, updatedat';
const inviteSelect = 'id, roomid, invitedemail, invitedby, code, status, expiresat, createdat, updatedat';
const missingSchemaMessage =
  '방 기능 DB 테이블이 아직 Supabase에 적용되지 않았습니다. Supabase SQL Editor에서 rooms, roommembers, roominvites 생성 SQL을 먼저 실행해 주세요.';

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

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
    message.includes('rooms') ||
    message.includes('roommembers') ||
    message.includes('roominvites')
  ) {
    return missingSchemaMessage;
  }

  return message;
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

function normalizeInvite(row: Partial<RoomInvite>): RoomInvite {
  return {
    id: row.id ?? '',
    roomid: row.roomid ?? '',
    invitedemail: row.invitedemail ?? null,
    invitedby: row.invitedby ?? '',
    code: row.code ?? '',
    status: row.status ?? 'pending',
    expiresat: row.expiresat ?? null,
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
  invites: RoomInvite[],
) {
  const membersByRoomId = new Map<string, RoomMember[]>();
  const invitesByRoomId = new Map<string, RoomInvite[]>();

  members.forEach((member) => {
    const current = membersByRoomId.get(member.roomid) ?? [];
    current.push(member);
    membersByRoomId.set(member.roomid, current);
  });

  invites.forEach((invite) => {
    const current = invitesByRoomId.get(invite.roomid) ?? [];
    current.push(invite);
    invitesByRoomId.set(invite.roomid, current);
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
        invites: invitesByRoomId.get(room.id) ?? [],
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
      return;
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
      return;
    }

    const roomIds = Array.from(
      new Set((myMembershipRows ?? []).map((row) => String(row.roomid)).filter(Boolean)),
    );

    if (roomIds.length === 0) {
      setRooms([]);
      setIsloadingrooms(false);
      return;
    }

    const [{ data: roomRows, error: roomsError }, { data: memberRows, error: membersError }, { data: inviteRows, error: invitesError }] =
      await Promise.all([
        supabase.from('rooms').select(roomSelect).in('id', roomIds).order('createdat', { ascending: false }),
        supabase.from('roommembers').select(memberSelect).in('roomid', roomIds).order('createdat', { ascending: true }),
        supabase
          .from('roominvites')
          .select(inviteSelect)
          .in('roomid', roomIds)
          .eq('status', 'pending')
          .order('createdat', { ascending: false }),
      ]);

    const firstError = roomsError || membersError || invitesError;
    if (firstError) {
      setRoomerror(getRoomErrorMessage(firstError));
      setRooms([]);
      setIsloadingrooms(false);
      return;
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
    const normalizedInvites = (inviteRows ?? []).map((row) => normalizeInvite(row as Partial<RoomInvite>));

    setRooms(buildRoomDetails(user.id, normalizedRooms, normalizedMembers, normalizedInvites));
    setIsloadingrooms(false);
  }, [user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      loadRooms();
    }, 0);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [loadRooms]);

  const createRoom = useCallback(
    async (input: RoomInput): Promise<RoomMutationResult> => {
      if (!user) {
        return { error: '로그인이 필요합니다.' };
      }

      const validationerror = validateRoomInput(input);
      if (validationerror) {
        return { error: validationerror };
      }

      const now = new Date().toISOString();
      const { data: roomRow, error: roomError } = await supabase
        .from('rooms')
        .insert({
          ownerid: user.id,
          invitecode: generateInviteCode(),
          ...cleanRoomInput(input),
          createdat: now,
          updatedat: now,
        })
        .select(roomSelect)
        .single();

      if (roomError) {
        const message = getRoomErrorMessage(roomError);
        setRoomerror(message);
        return { error: message };
      }

      const room = normalizeRoom(roomRow as Partial<Room>);
      const { data: memberRow, error: memberError } = await supabase
        .from('roommembers')
        .insert({
          roomid: room.id,
          userid: user.id,
          role: 'owner',
          createdat: now,
          updatedat: now,
        })
        .select(memberSelect)
        .single();

      if (memberError) {
        const message = getRoomErrorMessage(memberError);
        setRoomerror(message);
        return { error: message };
      }

      const membership = normalizeMember(memberRow as Partial<RoomMember>, new Map());
      const nextRoom = { room, membership, members: [membership], invites: [] };
      setRooms((current) => [nextRoom, ...current]);
      return { room: nextRoom };
    },
    [user],
  );

  const updateRoom = useCallback(
    async (roomid: string, input: RoomInput): Promise<RoomMutationResult> => {
      if (!user) {
        return { error: '로그인이 필요합니다.' };
      }

      const current = roomById.get(roomid);
      if (!current || !canManageRoom(current.membership.role)) {
        return { error: '방 설정을 바꿀 권한이 없습니다.' };
      }

      const validationerror = validateRoomInput(input);
      if (validationerror) {
        return { error: validationerror };
      }

      const { data, error } = await supabase
        .from('rooms')
        .update({
          ...cleanRoomInput(input),
          updatedat: new Date().toISOString(),
        })
        .eq('id', roomid)
        .select(roomSelect)
        .single();

      if (error) {
        const message = getRoomErrorMessage(error);
        setRoomerror(message);
        return { error: message };
      }

      const room = normalizeRoom(data as Partial<Room>);
      setRooms((items) => items.map((item) => (item.room.id === roomid ? { ...item, room } : item)));
      return { room: { ...current, room } };
    },
    [roomById, user],
  );

  const deleteRoom = useCallback(
    async (roomid: string) => {
      if (!user) {
        return { error: '로그인이 필요합니다.' };
      }

      const current = roomById.get(roomid);
      if (!current || !canOwnRoom(current.membership.role)) {
        return { error: '방장만 방을 삭제할 수 있습니다.' };
      }

      const { error } = await supabase.from('rooms').delete().eq('id', roomid).eq('ownerid', user.id);

      if (error) {
        const message = getRoomErrorMessage(error);
        setRoomerror(message);
        return { error: message };
      }

      setRooms((items) => items.filter((item) => item.room.id !== roomid));
      return {};
    },
    [roomById, user],
  );

  const createInvite = useCallback(
    async (roomid: string, invitedemail: string): Promise<RoomMutationResult> => {
      if (!user) {
        return { error: '로그인이 필요합니다.' };
      }

      const current = roomById.get(roomid);
      if (!current) {
        return { error: '방을 찾을 수 없습니다.' };
      }

      const canInvite = canManageRoom(current.membership.role) || current.room.allowmemberinvite;
      if (!canInvite) {
        return { error: '초대 권한이 없습니다.' };
      }

      const email = invitedemail.trim().toLowerCase() || null;
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('roominvites')
        .insert({
          roomid,
          invitedemail: email,
          invitedby: user.id,
          code: generateInviteCode(),
          status: 'pending',
          expiresat: null,
          createdat: now,
          updatedat: now,
        })
        .select(inviteSelect)
        .single();

      if (error) {
        const message = getRoomErrorMessage(error);
        setRoomerror(message);
        return { error: message };
      }

      const invite = normalizeInvite(data as Partial<RoomInvite>);
      setRooms((items) =>
        items.map((item) =>
          item.room.id === roomid ? { ...item, invites: [invite, ...item.invites] } : item,
        ),
      );
      return { invite };
    },
    [roomById, user],
  );

  const cancelInvite = useCallback(
    async (roomid: string, inviteid: string) => {
      const current = roomById.get(roomid);
      if (!current || !canManageRoom(current.membership.role)) {
        return { error: '초대를 취소할 권한이 없습니다.' };
      }

      const { error } = await supabase
        .from('roominvites')
        .update({ status: 'canceled', updatedat: new Date().toISOString() })
        .eq('id', inviteid)
        .eq('roomid', roomid);

      if (error) {
        const message = getRoomErrorMessage(error);
        setRoomerror(message);
        return { error: message };
      }

      setRooms((items) =>
        items.map((item) =>
          item.room.id === roomid
            ? { ...item, invites: item.invites.filter((invite) => invite.id !== inviteid) }
            : item,
        ),
      );
      return {};
    },
    [roomById],
  );

  const joinRoomByCode = useCallback(
    async (rawCode: string) => {
      if (!user) {
        return { error: '로그인이 필요합니다.' };
      }

      const code = rawCode.trim().toUpperCase();
      if (!code) {
        return { error: '초대코드를 입력해 주세요.' };
      }

      const { data: inviteRow, error: inviteError } = await supabase
        .from('roominvites')
        .select(inviteSelect)
        .eq('code', code)
        .eq('status', 'pending')
        .maybeSingle();

      if (inviteError) {
        const message = getRoomErrorMessage(inviteError);
        setRoomerror(message);
        return { error: message };
      }

      if (!inviteRow) {
        return { error: '사용 가능한 초대코드를 찾을 수 없습니다.' };
      }

      const invite = normalizeInvite(inviteRow as Partial<RoomInvite>);
      if (invite.invitedemail && user.email && invite.invitedemail !== user.email.toLowerCase()) {
        return { error: '이 이메일로 받은 초대가 아닙니다.' };
      }

      const { data: existingMember } = await supabase
        .from('roommembers')
        .select(memberSelect)
        .eq('roomid', invite.roomid)
        .eq('userid', user.id)
        .maybeSingle();

      const now = new Date().toISOString();
      if (!existingMember) {
        const { error: memberError } = await supabase.from('roommembers').insert({
          roomid: invite.roomid,
          userid: user.id,
          role: 'member',
          createdat: now,
          updatedat: now,
        });

        if (memberError) {
          const message = getRoomErrorMessage(memberError);
          setRoomerror(message);
          return { error: message };
        }
      }

      const { error: updateError } = await supabase
        .from('roominvites')
        .update({ status: 'accepted', updatedat: now })
        .eq('id', invite.id);

      if (updateError) {
        const message = getRoomErrorMessage(updateError);
        setRoomerror(message);
        return { error: message };
      }

      await loadRooms();
      return {};
    },
    [loadRooms, user],
  );

  const changeMemberRole = useCallback(
    async (roomid: string, memberid: string, role: 'admin' | 'member') => {
      const current = roomById.get(roomid);
      if (!current || !canOwnRoom(current.membership.role)) {
        return { error: '방장만 멤버 권한을 바꿀 수 있습니다.' };
      }

      const { error } = await supabase
        .from('roommembers')
        .update({ role, updatedat: new Date().toISOString() })
        .eq('id', memberid)
        .eq('roomid', roomid)
        .neq('role', 'owner');

      if (error) {
        const message = getRoomErrorMessage(error);
        setRoomerror(message);
        return { error: message };
      }

      await loadRooms();
      return {};
    },
    [loadRooms, roomById],
  );

  const removeMember = useCallback(
    async (roomid: string, memberid: string) => {
      const current = roomById.get(roomid);
      if (!current || !canOwnRoom(current.membership.role)) {
        return { error: '방장만 멤버를 내보낼 수 있습니다.' };
      }

      const { error } = await supabase
        .from('roommembers')
        .delete()
        .eq('id', memberid)
        .eq('roomid', roomid)
        .neq('role', 'owner');

      if (error) {
        const message = getRoomErrorMessage(error);
        setRoomerror(message);
        return { error: message };
      }

      await loadRooms();
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
    createInvite,
    cancelInvite,
    joinRoomByCode,
    changeMemberRole,
    removeMember,
  };
}
