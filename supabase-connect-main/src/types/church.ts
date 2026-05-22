export interface Church {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  banner_url: string | null;
  status: 'active' | 'inactive' | 'suspended';
  theme_color: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  church_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: 'male' | 'female' | null;
  photo_url: string | null;
  status: 'active' | 'inactive' | 'pending';
  date_joined: string | null;
  date_of_birth: string | null;
  group_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

export interface MemberRole {
  id: string;
  member_id: string;
  role_id: string;
  church_id: string;
  assigned_at: string;
  assigned_by: string | null;
}

export interface Community {
  id: string;
  church_id: string;
  name: string;
  description: string | null;
  leader_id: string | null;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface CommunityMember {
  id: string;
  community_id: string;
  member_id: string;
  joined_at: string;
}

export interface Ministry {
  id: string;
  church_id: string;
  name: string;
  description: string | null;
  leader_id: string | null;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface ChurchGroup {
  id: string;
  church_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Family {
  id: string;
  church_id: string;
  name: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  member_id: string;
  role: 'father' | 'mother' | 'child' | 'guardian' | 'other';
}

export interface ContributionCategory {
  id: string;
  church_id: string;
  name: string;
  description: string | null;
  is_special: boolean;
  created_at: string;
}

export interface Contribution {
  id: string;
  church_id: string;
  member_id: string | null;
  contribution_category_id: string;
  amount: number;
  currency: string;
  donor_name: string | null;
  phone: string | null;
  payment_reference: string | null;
  notes: string | null;
  date: string;
  created_at: string;
  created_by: string | null;
}

export interface ChurchEvent {
  id: string;
  church_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  created_at: string;
}

export interface EventRequest {
  id: string;
  church_id: string;
  member_id: string | null;
  request_type: 'wedding' | 'baptism' | 'funeral' | 'other';
  requester_name: string;
  requester_phone: string | null;
  description: string | null;
  preferred_date: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  admin_notes: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  church_id: string;
  title: string;
  content: string;
  is_published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Sermon {
  id: string;
  church_id: string;
  title: string;
  preacher: string | null;
  date: string;
  content: string | null;
  audio_url: string | null;
  video_url: string | null;
  created_at: string;
}

export interface PrayerRequest {
  id: string;
  member_id: string | null;
  request_text: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  church_id: string | null;
  offering_amount: number | null;
}

export interface PrayerRequestInsert {
  request_text: string;
  member_id: string;
  church_id: string;
  offering_amount?: number | null;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface MassIntention {
  id: string;
  member_id: string | null;
  intention_type: string;
  message: string;
  offering_amount: number | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  church_id: string | null;
}

export interface CommunityHelpRequest {
  id: string;
  member_id: string | null;
  category: string;
  description: string;
  target_amount: number | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  church_id: string | null;
}

export interface ActivityLog {
  id: string;
  church_id: string | null;
  performer_id: string | null;
  performer_name: string | null;
  performer_role: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  detail: string | null;
  created_at: string;
}
