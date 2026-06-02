import type { SessionUser } from "@/lib/auth";
import {
  createAnnouncement,
  getAnnouncements,
  type AnnouncementPriority,
  type TeamAnnouncement
} from "@/lib/messageService";

export type AnnouncementAudience =
  | "All users"
  | "Managers"
  | "Call Center"
  | "Storekeepers"
  | "Sales Team"
  | "Specific company";

export type AnnouncementCenterItem = TeamAnnouncement & {
  audience: AnnouncementAudience;
  companyName?: string;
  readCount: number;
};

export const announcementAudiences: AnnouncementAudience[] = [
  "All users",
  "Managers",
  "Call Center",
  "Storekeepers",
  "Sales Team",
  "Specific company"
];

export const announcementPriorities: AnnouncementPriority[] = [
  "Normal",
  "Important",
  "Critical",
  "Emergency"
];

function normalizeAudience(audience: TeamAnnouncement["audience"]): AnnouncementAudience {
  if (audience === "All" || audience === "Agents") return audience === "All" ? "All users" : "Call Center";
  return audience;
}

export function getAnnouncementCenterItems(): AnnouncementCenterItem[] {
  return getAnnouncements().map((announcement, index) => ({
    ...announcement,
    audience: normalizeAudience(announcement.audience),
    readCount: announcement.readCount ?? Math.max(8, 42 - index * 5)
  }));
}

export function createAnnouncementCenterItem(
  input: {
    audience: AnnouncementAudience;
    body: string;
    companyName?: string;
    priority: AnnouncementPriority;
    title: string;
  },
  user: SessionUser
) {
  const announcements = createAnnouncement(
    {
      audience: input.audience,
      body: input.body,
      priority: input.priority,
      title: input.title
    },
    user
  );

  return announcements.map((announcement, index) => ({
    ...announcement,
    audience: normalizeAudience(announcement.audience),
    companyName: announcement.id === announcements[0]?.id ? input.companyName : announcement.companyName,
    readCount: announcement.id === announcements[0]?.id ? 0 : announcement.readCount ?? Math.max(8, 42 - index * 5)
  })) satisfies AnnouncementCenterItem[];
}
