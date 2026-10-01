export interface Friend {
  id: number;
  line_user_id: string;
  token: string;
  display_name: string;
  picture_url: string | null;
  status_message: string | null;
  blocked: number;
  ai_enabled: number;
  note: string;
  followed_at: number;
  unfollowed_at: number | null;
  last_message_at: number | null;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface Message {
  id: number;
  friend_id: number;
  direction: "in" | "out";
  content: string;
  source: MessageSource;
  ref_id: number | null;
  created_at: number;
}

export type MessageSource =
  | "user"
  | "manual"
  | "broadcast"
  | "step"
  | "auto"
  | "ai";

export interface AutoReply {
  id: number;
  keyword: string;
  match_type: "exact" | "contains";
  reply: string;
  add_tag_id: number | null;
  enabled: number;
  hit_count: number;
}

export interface Scenario {
  id: number;
  name: string;
  trigger: "follow" | "tag" | "manual";
  trigger_tag_id: number | null;
  enabled: number;
  created_at: number;
}

export interface ScenarioStep {
  id: number;
  scenario_id: number;
  delay_minutes: number;
  content: string;
}

export interface Broadcast {
  id: number;
  title: string;
  content: string;
  tag_ids: string;
  status: "scheduled" | "sending" | "sent" | "canceled" | "failed";
  scheduled_at: number;
  sent_at: number | null;
  recipient_count: number;
  created_at: number;
}

export interface Link {
  id: number;
  code: string;
  name: string;
  url: string;
  add_tag_id: number | null;
  created_at: number;
}
