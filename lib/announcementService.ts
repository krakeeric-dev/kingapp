import type { SessionUser } from "@/lib/auth";
import {
  createAnnouncement,
  getAnnouncementsForUser,
  type AnnouncementPriority,
  type TeamAnnouncement
} from "@/lib/messageService";

export type AnnouncementAudience =
  | "All users"
  | "Managers"
  | "Customer Care & Relationship Management (CCRM)"
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
  "Customer Care & Relationship Management (CCRM)",
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
  if (audience === "All" || audience === "Agents") return audience === "All" ? "All users" : "Customer Care & Relationship Management (CCRM)";
  return audience;
}

export function getAnnouncementCenterItems(user?: SessionUser): AnnouncementCenterItem[] {
  const announcements = user ? getAnnouncementsForUser(user) : getAnnouncementsForUser({ role: "admin", companyId: "all", assignedCompanies: ["all"] } as SessionUser);
  return announcements.map((announcement, index) => ({
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
