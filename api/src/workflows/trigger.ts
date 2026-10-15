export interface WorkflowWindow {
  from: string;
  to: string;
}

export type WorkflowTrigger =
  | {
      kind: 'dumpCreated';
      occurredAt: string;
      dump: { id: string; content: string; tagNames: string[] };
    }
  | {
      kind: 'tagDeleted';
      occurredAt: string;
      tag: { id: string; name: string };
    }
  | { kind: 'manual'; occurredAt: string }
  | { kind: 'schedule'; occurredAt: string; window: WorkflowWindow };

export type EventTrigger = Extract<
  WorkflowTrigger,
  { kind: 'dumpCreated' | 'tagDeleted' }
>;
