export interface Bookmark {
  id: string;
  url: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  use_cases: string[];
  commercial_use: string;
  raw_content?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface BookmarkAnalysis {
  title: string;
  summary: string;
  category: string;
  tags: string[];
  useCases: string[];
  commercialUse: string;
}

export interface SearchResultItem extends Bookmark {
  recommendationReason?: string;
  matchScore?: number;
}

export interface SearchQueryResponse {
  results: SearchResultItem[];
  totalMatches: number;
}
