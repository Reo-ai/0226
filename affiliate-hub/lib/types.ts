export type Program = {
  id: number;
  name: string;
  asp: string;
  category: string;
  url: string;
  reward_type: "fixed" | "rate";
  reward: number;
  avg_price: number;
  approval_rate: number;
  est_cvr: number;
  status: "candidate" | "active" | "paused";
  notes: string;
  created_at: number;
};

export type Link = {
  id: number;
  code: string;
  program_id: number | null;
  name: string;
  url: string;
  channel: string;
  created_at: number;
};

export type Conversion = {
  id: number;
  program_id: number | null;
  link_id: number | null;
  occurred_at: number;
  amount: number;
  status: "pending" | "approved" | "rejected";
  note: string;
  created_at: number;
};

export type Post = {
  id: number;
  program_id: number | null;
  link_id: number | null;
  platform: string;
  kind: string;
  body: string;
  status: "draft" | "posted";
  posted_at: number | null;
  created_at: number;
};
