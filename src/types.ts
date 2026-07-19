export interface Setting {
  title: string;
  subtitle: string;
  avatarUrl: string;
  topHeroGifUrl: string;
  bottomCornerGifUrls: string[];
  activeBottomCornerGifUrl: string;
  scrapbookThreeImages: string[];
  socialLinks: SocialLink[];
  tagsList?: string[]; // Custom managed tags list
  searchPlaceholderName?: string; // Custom search input placeholder
  websiteIconUrl?: string; // Custom website favicon icon URL
}

export interface SocialLink {
  id: string;
  title: string;
  description: string;
  url: string;
}

export interface Post {
  id?: string;
  title?: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  tags: string[];
  isPinned: boolean;
  date: string; // Format: YYYY.MM.DD
  createdAt: number; // timestamp
  version?: string; // e.g. "v1.0.1"
  leftBorderColor?: string; // custom hex color e.g. "#FF0000"
  borderPreset?: "solid" | "striped" | "none"; // custom style
  tiltPreset?: "random" | "none" | "custom";
  tiltAngle?: number;
}
