export type AdminMiniconPackStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "retired"
  | "suspended";

export type AdminMiniconItem = {
  id: string;
  name: string;
  imageUrl: string;
};

export type AdminMiniconPack = {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  status: AdminMiniconPackStatus;
  isOfficial: boolean;
  creatorId: string | null;
  creatorName: string;
  itemCount: number;
  items: AdminMiniconItem[];
  createdAt: string;
  publishedAt: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
};
