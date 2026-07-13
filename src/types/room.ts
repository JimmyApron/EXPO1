export const RoomRoles = ['owner', 'admin', 'member'] as const;

export type RoomRole = (typeof RoomRoles)[number];

export type Room = {
  id: string;
  ownerid: string;
  name: string;
  description: string;
  invitecode: string;
  allowmemberinvite: boolean;
  createdat: string;
  updatedat: string;
};

export type RoomInput = {
  name: string;
  description: string;
  allowmemberinvite: boolean;
};

export type RoomMember = {
  id: string;
  roomid: string;
  userid: string;
  role: RoomRole;
  email: string | null;
  nickname: string | null;
  createdat: string;
  updatedat: string;
};

export type RoomInviteStatus = 'pending' | 'accepted' | 'declined' | 'canceled';

export type RoomInvite = {
  id: string;
  roomid: string;
  invitedemail: string | null;
  invitedby: string;
  code: string;
  status: RoomInviteStatus;
  expiresat: string | null;
  createdat: string;
  updatedat: string;
};

export type RoomWithDetails = {
  room: Room;
  membership: RoomMember;
  members: RoomMember[];
  invites: RoomInvite[];
};

export function normalizeRoomRole(role: unknown): RoomRole {
  if (RoomRoles.includes(role as RoomRole)) {
    return role as RoomRole;
  }

  return 'member';
}

export function canManageRoom(role: RoomRole) {
  return role === 'owner' || role === 'admin';
}

export function canOwnRoom(role: RoomRole) {
  return role === 'owner';
}
