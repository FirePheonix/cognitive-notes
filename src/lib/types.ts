export type DocNode = {
  id: string;
  name: string;
  type: "folder" | "file" | "drawing";
  children?: DocNode[];
  content?: string;
  createdAt: number;
  updatedAt: number;
};

export type AppState = {
  tree: DocNode[];
  activeId: string | null;
};
