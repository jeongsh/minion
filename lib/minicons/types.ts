export type MiniconItem = {
  id: string;
  packId: string;
  packName: string;
  name: string;
  imageUrl: string;
};

export type MiniconPack = {
  id: string;
  slug: string;
  name: string;
  description: string;
  coverUrl: string;
  isOfficial: boolean;
  creatorName?: string;
  publishedAt?: string | null;
  tags?: string[];
  items: MiniconItem[];
};

export type CommentMinicon = Pick<
  MiniconItem,
  "id" | "packId" | "packName" | "name" | "imageUrl"
>;
