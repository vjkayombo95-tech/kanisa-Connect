export type MemberHomeData = {
  memberId: string | null;
  memberName: string;
  churchName: string | null;
  churchLogoUrl: string | null;
  churchAddress: string | null;
  churchPhone: string | null;
  churchEmail: string | null;
  churchOfficeHours: string | null;
  churchEmergencyContact: string | null;
  churchLivestreamUrl: string | null;
  churchSocialLinks: Array<{ label: string; url: string }>;
  totalPaid: number;
  totalThisMonth: number;
  pendingAmount: number;
  lastPayment: {
    amount: number;
    date: string | null;
    label: string;
    purpose: string;
    status: string;
  } | null;
  latestAnnouncement: {
    title: string;
    content: string | null;
    date: string | null;
  } | null;
};

export type NextMassSummary = {
  success?: boolean;
  mass?: {
    id: string;
    title: string;
    description: string | null;
    mass_date: string;
    start_time: string;
    end_time: string | null;
    response_deadline: string | null;
    ask_for_rsvp: boolean;
    my_member_id: string | null;
    my_response: "yes" | "maybe" | "no" | null;
  } | null;
  yes_count?: number;
  maybe_count?: number;
  no_count?: number;
  response_rate?: number;
  error?: string;
};

export type MemberJourneySummary = {
  activeCount: number;
  latestStatus: string | null;
  latestDate: string | null;
  title: string | null;
  description: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  location: string | null;
};
