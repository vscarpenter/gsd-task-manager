export interface EditDraft {
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
  dueDate?: string;
  tags: string[];
  dependencies: string[];
}
