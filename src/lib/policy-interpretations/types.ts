export type PolicyInterpretation = {
  id: string;
  title: string;
  summary: string | null;
  region_id: string | null;
  region_bloc: string;
  topic_tags: string[];
  department: string | null;
  original_filename: string;
  mime_type: string;
  file_ext: string;
  file_size_bytes: number;
  storage_path: string;
  is_demo: boolean;
  is_published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PolicyInterpretationPublic = Omit<
  PolicyInterpretation,
  "storage_path" | "created_by"
>;
