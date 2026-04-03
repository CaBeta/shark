export interface Library {
  id: string;
  name: string;
  path: string;
  created_at: string;
}

export interface Item {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
  width: number | null;
  height: number | null;
  tags: string;
  rating: number;
  notes: string;
  sha256: string;
  status: 'active' | 'deleted' | 'corrupted';
  created_at: string;
  modified_at: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

export interface ItemFilter {
  folder_id?: string | null;
  file_types?: string[] | null;
  rating_min?: number | null;
  search_query?: string | null;
}

export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

export interface Pagination {
  page: number;
  page_size: number;
}

export interface ItemPage {
  items: Item[];
  total: number;
  page: number;
  page_size: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
}

export type ThumbnailSize = 'S256' | 'S1024';

export interface SearchResult {
  item: Item;
  rank: number;
}
