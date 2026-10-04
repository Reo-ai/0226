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
  source_id: number | null;
  rich_menu_id: number | null;
  followed_at: number;
  unfollowed_at: number | null;
  last_message_at: number | null;
  score: number;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export type MessageSource = "user" | "manual" | "broadcast" | "step" | "auto" | "ai" | "form";
export type Channel = "reply" | "push" | "none";

export interface Message {
  id: number;
  friend_id: number;
  direction: "in" | "out";
  content: string;
  source: MessageSource;
  channel: Channel;
  ref_id: number | null;
  created_at: number;
}

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
  /** このタグが付いている人には配信しない（付いた時点で停止） */
  stop_tag_id: number | null;
  enabled: number;
  created_at: number;
}

export type Delivery = "push" | "reply";

export interface ScenarioStep {
  id: number;
  scenario_id: number;
  delay_minutes: number;
  delivery: Delivery;
  /** 1: delay_minutes を「開始日の0時(JST)から」数える（例: 1日後の20:00） */
  fixed_time: number;
  content: string;
  /** 送る条件：このタグが has=ある人だけ / not=ない人だけ（null なら全員） */
  cond_tag_id: number | null;
  cond_type: "has" | "not" | null;
}

export interface Broadcast {
  id: number;
  title: string;
  content: string;
  tag_ids: string;
  delivery: Delivery;
  status: "scheduled" | "sending" | "sent" | "canceled" | "failed";
  error: string | null;
  scheduled_at: number;
  sent_at: number | null;
  recipient_count: number;
  created_at: number;
  ab_group?: number | null;
  ab_variant?: "A" | "B" | null;
}

export interface Link {
  id: number;
  code: string;
  name: string;
  url: string;
  add_tag_id: number | null;
  created_at: number;
}

export interface RichMenuArea {
  type: "message" | "uri" | "tag" | "form" | "none";
  value: string;
}

export interface RichMenu {
  id: number;
  name: string;
  chat_bar_text: string;
  layout: string;
  areas: string;
  image_data: string;
  line_rich_menu_id: string | null;
  tag_id: number | null;
  is_default: number;
  created_at: number;
}

export interface FormField {
  label: string;
  type: "text" | "textarea" | "select" | "radio" | "checkbox" | "email" | "tel";
  options: string[];
  required: boolean;
}

export interface Form {
  id: number;
  title: string;
  description: string;
  fields: string;
  add_tag_id: number | null;
  thanks_message: string;
  created_at: number;
}

export interface Source {
  id: number;
  code: string;
  name: string;
  add_tag_id: number | null;
  created_at: number;
}
