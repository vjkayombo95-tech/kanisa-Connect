import { formatTZS } from "@/lib/currency";

import {
  arrayAt,
  cachedLiturgy,
  categoryEvent,
  countLabel,
  endOfToday,
  numberAt,
  priorityForCount,
  stringAt,
  tomorrowEnd,
} from "./generators";
import { routeFor } from "./registry";
import type { EventRule } from "./types";

export const eventRules: EventRule[] = [
  {
    id: "member-liturgy",
    workspaces: ["member"],
    generate: (input) => {
      const liturgy = cachedLiturgy(input);
      const celebration = stringAt(input.dashboardContext, "todayLiturgy.celebration", stringAt(liturgy, "celebration"));
      const gospel = stringAt(input.dashboardContext, "todayLiturgy.daily_readings.0.gospel_reference", stringAt(liturgy, "daily_readings.0.gospel_reference"));
      const events = [];

      if (gospel || celebration) {
        events.push(categoryEvent(
          input,
          "todays-gospel",
          "liturgy",
          "info",
          "Today's Gospel available",
          gospel || celebration || "Open today's readings.",
          routeFor(input.workspace, "readings"),
          "Read",
        ));
      }

      return events;
    },
  },
  {
    id: "member-personal-records",
    workspaces: ["member"],
    generate: (input) => {
      const prayerCount = numberAt(input.dashboardContext, "prayers.totalCount", arrayAt(input.dashboardContext, "prayers.records").length);
      const intentionCount = numberAt(input.dashboardContext, "massIntentions.totalCount", arrayAt(input.dashboardContext, "massIntentions.records").length);
      const announcementCount = arrayAt(input.dashboardContext, "announcements").length;
      const eventCount = arrayAt(input.dashboardContext, "events").length;
      const receiptCount = numberAt(input.dashboardContext, "stats.count");
      const result = [];

      if (prayerCount > 0) {
        result.push(categoryEvent(
          input,
          "prayer-status",
          "pastoral",
          "medium",
          "Prayer request status updated",
          `${countLabel(prayerCount, "request")} in your prayer history.`,
          routeFor(input.workspace, "prayerRequests"),
          "Track",
        ));
      }

      if (intentionCount > 0) {
        result.push(categoryEvent(
          input,
          "mass-intention-active",
          "pastoral",
          "medium",
          "Mass intention active",
          `${countLabel(intentionCount, "intention")} currently tracked.`,
          routeFor(input.workspace, "massIntentions"),
          "Open",
          tomorrowEnd(input),
        ));
      }

      if (announcementCount > 0) {
        result.push(categoryEvent(input, "new-announcement", "community", "info", "New announcement", "A recent parish announcement is available.", routeFor(input.workspace, "announcements"), "View"));
      }

      if (eventCount > 0) {
        result.push(categoryEvent(input, "upcoming-event", "community", "low", "Upcoming parish event", `${countLabel(eventCount, "event")} on the parish calendar.`, routeFor(input.workspace, "events"), "View"));
      }

      if (receiptCount > 0) {
        result.push(categoryEvent(input, "contribution-receipt", "finance", "info", "Contribution receipt available", `${countLabel(receiptCount, "contribution")} in your giving history.`, routeFor(input.workspace, "giving"), "Open"));
      }

      return result;
    },
  },
  {
    id: "pastoral-queues",
    workspaces: ["pastoral"],
    generate: (input) => {
      const pendingPrayers = numberAt(input.dashboardContext, "summary.prayerRequests.pending");
      const pendingIntentions = numberAt(input.dashboardContext, "summary.massIntentions.pending");
      const help = numberAt(input.dashboardContext, "summary.communityHelp.pending");
      const result = [];

      if (pendingPrayers > 0) {
        result.push(categoryEvent(input, "pending-prayers", "pastoral", priorityForCount(pendingPrayers, 5), "Prayer requests pending", `${countLabel(pendingPrayers, "request")} need pastoral review.`, routeFor(input.workspace, "prayerRequests"), "Review"));
      }

      if (pendingIntentions > 0) {
        result.push(categoryEvent(input, "pending-intentions", "pastoral", priorityForCount(pendingIntentions, 5), "Mass intentions need scheduling", `${countLabel(pendingIntentions, "intention")} waiting.`, routeFor(input.workspace, "massIntentions"), "Schedule"));
      }

      if (help > 0) {
        result.push(categoryEvent(input, "community-help", "community", priorityForCount(help, 4), "Community help needs review", `${countLabel(help, "request")} awaiting action.`, routeFor(input.workspace, "prayerRequests"), "Review"));
      }

      return result;
    },
  },
  {
    id: "pastoral-liturgy",
    workspaces: ["pastoral"],
    generate: (input) => {
      const celebration = stringAt(input.dashboardContext, "todayLiturgy.celebration", stringAt(cachedLiturgy(input), "celebration"));
      if (!celebration) return [];
      return [
        categoryEvent(input, "important-feast", "liturgy", "info", "Important feast approaching", celebration, routeFor(input.workspace, "readings"), "Prepare", endOfToday(input)),
      ];
    },
  },
  {
    id: "church-admin-operations",
    workspaces: ["church_admin"],
    generate: (input) => {
      const approvals = numberAt(input.dashboardContext, "deferred.pendingMemberApprovals");
      const invitations = arrayAt(input.dashboardContext, "invitations").filter((item) => stringAt(item, "status") === "pending").length || arrayAt(input.dashboardContext, "invitations").length;
      const upcomingEvents = arrayAt(input.dashboardContext, "deferred.upcomingEvents").length;
      const result = [];

      if (approvals > 0) {
        result.push(categoryEvent(input, "registrations-awaiting-review", "administration", priorityForCount(approvals, 5), "Registrations awaiting review", `${countLabel(approvals, "registration")} need attention.`, routeFor(input.workspace, "members"), "Review"));
      }

      if (invitations > 0) {
        result.push(categoryEvent(input, "invitations-pending", "administration", priorityForCount(invitations, 5), "Invitations pending", `${countLabel(invitations, "invitation")} still open.`, routeFor(input.workspace, "invitations"), "Open"));
      }

      if (upcomingEvents > 0) {
        result.push(categoryEvent(input, "community-meeting", "community", "low", "Community meeting on calendar", `${countLabel(upcomingEvents, "upcoming event")} visible.`, routeFor(input.workspace, "events"), "View"));
      }

      return result;
    },
  },
  {
    id: "church-admin-announcements",
    workspaces: ["church_admin"],
    generate: (input) => {
      const announcement = stringAt(input.dashboardContext, "critical.latestAnnouncement.title");
      if (!announcement) return [];
      return [
        categoryEvent(input, "announcement-review", "administration", "info", "Announcement needs review", announcement, routeFor(input.workspace, "announcements"), "Open", tomorrowEnd(input)),
      ];
    },
  },
  {
    id: "finance-signals",
    workspaces: ["finance"],
    generate: (input) => {
      const today = numberAt(input.dashboardContext, "summary.todayContributions");
      const month = numberAt(input.dashboardContext, "summary.thisMonthContributions");
      const pledges = numberAt(input.dashboardContext, "outstandingPledges");
      const recent = arrayAt(input.dashboardContext, "recentContributions");
      const result = [];

      if (pledges > 0) {
        result.push(categoryEvent(input, "outstanding-pledges", "finance", "high", "Outstanding pledges", `${formatTZS(pledges)} unpaid pledge balance.`, routeFor(input.workspace, "pledges"), "Review"));
      }

      if (recent.some((item) => !stringAt(item, "payment_reference"))) {
        result.push(categoryEvent(input, "pending-reconciliation", "finance", "medium", "Pending reconciliation", "Recent contributions need payment references checked.", routeFor(input.workspace, "contributions"), "Reconcile"));
      }

      if (today === 0 && month > 0) {
        result.push(categoryEvent(input, "collections-below-average", "finance", "low", "Collections below average", "No collections recorded today yet.", routeFor(input.workspace, "reports"), "View report"));
      }

      const largest = recent.reduce((max, item) => Math.max(max, numberAt(item, "amount")), 0);
      if (largest >= 1000000) {
        result.push(categoryEvent(input, "large-donation", "finance", "high", "Large donation received", `${formatTZS(largest)} appears in recent collections.`, routeFor(input.workspace, "contributions"), "Open"));
      }

      return result;
    },
  },
  {
    id: "super-admin-platform",
    workspaces: ["super_admin"],
    generate: (input) => {
      const alerts = numberAt(input.dashboardContext, "activeAlertCount");
      const pendingChurches = numberAt(input.dashboardContext, "pendingChurchCount");
      const runs = arrayAt(input.dashboardContext, "automationRuns");
      const failed = runs.filter((run) => stringAt(run, "status").toLowerCase() === "failed").length;
      const result = [];

      if (alerts > 0) {
        result.push(categoryEvent(input, "platform-health-warning", "platform", alerts >= 3 ? "critical" : "high", "Platform health warning", `${countLabel(alerts, "active alert")} require review.`, routeFor(input.workspace, "health"), "Review"));
      }

      if (pendingChurches > 0) {
        result.push(categoryEvent(input, "new-church-onboarded", "platform", "medium", "New church onboarded", `${countLabel(pendingChurches, "church")} pending approval.`, routeFor(input.workspace, "churches"), "Review"));
      }

      if (failed > 0) {
        result.push(categoryEvent(input, "failed-background-jobs", "platform", "high", "Failed background jobs", `${countLabel(failed, "job")} failed recently.`, routeFor(input.workspace, "jobs"), "Open"));
      } else if (runs.length > 0) {
        result.push(categoryEvent(input, "import-completed", "platform", "info", "Import or automation completed", `${countLabel(runs.length, "recent run")} available.`, routeFor(input.workspace, "imports"), "View"));
      }

      return result;
    },
  },
];
