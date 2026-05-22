import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Church,
  CreditCard,
  QrCode,
  TrendingUp,
  Users,
} from "lucide-react";

const stats = [
  {
    title: "Total Members",
    value: "1,284",
    label: "Active congregation members",
    icon: Users,
    accent: "from-amber-400/30 via-amber-300/10 to-transparent",
  },
  {
    title: "Monthly Giving",
    value: "TZS 12,840,000",
    label: "12.4% above last month",
    icon: CreditCard,
    accent: "from-yellow-400/30 via-yellow-300/10 to-transparent",
  },
  {
    title: "Attendance",
    value: "92%",
    label: "Weekend service participation",
    icon: Activity,
    accent: "from-orange-400/25 via-amber-300/10 to-transparent",
  },
  {
    title: "Upcoming Events",
    value: "8",
    label: "Programs scheduled this month",
    icon: Calendar,
    accent: "from-amber-500/30 via-orange-300/10 to-transparent",
  },
];

const givingBars = [
  { month: "Jan", value: 42, highlighted: false },
  { month: "Feb", value: 56, highlighted: false },
  { month: "Mar", value: 48, highlighted: false },
  { month: "Apr", value: 72, highlighted: true },
  { month: "May", value: 64, highlighted: false },
  { month: "Jun", value: 84, highlighted: true },
  { month: "Jul", value: 78, highlighted: false },
];

const quickInsights = [
  {
    title: "Giving Momentum",
    value: "+18.2%",
    note: "Strong response after missions Sunday",
    icon: TrendingUp,
  },
  {
    title: "QR Check-ins",
    value: "347",
    note: "Families checked in this week",
    icon: QrCode,
  },
];

const recentActivity = [
  {
    title: "John donated TZS 20,000",
    detail: "Online giving synced to the finance ledger",
    time: "6 minutes ago",
  },
  {
    title: "Mary checked in (QR)",
    detail: "Main sanctuary attendance captured automatically",
    time: "18 minutes ago",
  },
  {
    title: "Wedding event scheduled",
    detail: "Saturday ceremony added to the church calendar",
    time: "42 minutes ago",
  },
  {
    title: "Youth ministry report shared",
    detail: "Attendance and volunteer notes published to leadership",
    time: "1 hour ago",
  },
];

export default function ChurchDashboard() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_60%)]" />
      <div className="pointer-events-none absolute right-[-6rem] top-36 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.14),transparent_68%)] blur-3xl" />

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 space-y-6"
      >
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_30px_100px_-50px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:p-8">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                <Church className="h-3.5 w-3.5" />
                Demo Dashboard
              </div>
              <h1 className="mt-5 text-3xl font-bold font-serif text-white sm:text-4xl">
                Welcome back, Pastor
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
                Here&apos;s a clean snapshot of your church this week, from giving momentum and attendance
                to upcoming ministry activity.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:max-w-3xl">
                {quickInsights.map((insight, index) => (
                  <motion.div
                    key={insight.title}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                    animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.65,
                      delay: prefersReducedMotion ? 0 : 0.15 + index * 0.08,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                    className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 backdrop-blur-xl"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                        <insight.icon className="h-5 w-5" />
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300">
                        Healthy <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <p className="mt-4 text-sm text-white/58">{insight.title}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{insight.value}</p>
                    <p className="mt-2 text-sm leading-6 text-white/60">{insight.note}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97, y: 20 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.8, delay: prefersReducedMotion ? 0 : 0.12 }}
              className="rounded-[1.75rem] border border-primary/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(255,255,255,0.04))] p-5 shadow-[0_30px_90px_-40px_rgba(245,158,11,0.35)] backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-primary/80">This Sunday</p>
                  <p className="mt-2 text-xl font-semibold text-white">Service Readiness</p>
                </div>
                <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  87% Ready
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {[
                  ["Volunteers confirmed", "42 / 48"],
                  ["Announcements prepared", "5 queued"],
                  ["Follow-ups assigned", "18 families"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <span className="text-sm text-white/72">{label}</span>
                    <span className="text-sm font-semibold text-white">{value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.65,
                delay: prefersReducedMotion ? 0 : 0.12 + index * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={prefersReducedMotion ? undefined : { y: -6 }}
              className="group"
            >
              <div className="relative h-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_-45px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-[0_24px_90px_-40px_rgba(245,158,11,0.24)]">
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-br ${stat.accent}`} />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <stat.icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/55">
                      Live Demo
                    </span>
                  </div>
                  <p className="mt-8 text-sm text-white/60">{stat.title}</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
                  <p className="mt-3 text-sm leading-6 text-white/58">{stat.label}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 26 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.75, delay: prefersReducedMotion ? 0 : 0.2 }}
            className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_28px_90px_-50px_rgba(0,0,0,0.94)] backdrop-blur-xl sm:p-7"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/75">Analytics</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Giving Over Time</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/58">
                <BarChart3 className="h-4 w-4 text-primary" />
                Last 7 months
              </div>
            </div>

            <div className="mt-8 grid grid-cols-7 items-end gap-3">
              {givingBars.map((bar, index) => (
                <motion.div
                  key={bar.month}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
                  animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.55,
                    delay: prefersReducedMotion ? 0 : 0.28 + index * 0.05,
                  }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="flex h-64 w-full items-end rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-2">
                    <div
                      className={[
                        "w-full rounded-[1rem] transition-all duration-300",
                        bar.highlighted
                          ? "bg-[linear-gradient(180deg,rgba(251,191,36,0.95),rgba(245,158,11,0.42))] shadow-[0_0_30px_rgba(245,158,11,0.28)]"
                          : "bg-[linear-gradient(180deg,rgba(255,255,255,0.34),rgba(255,255,255,0.08))]",
                      ].join(" ")}
                      style={{ height: `${bar.value}%` }}
                    />
                  </div>
                  <span className="text-xs uppercase tracking-[0.16em] text-white/50">{bar.month}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 26 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.75, delay: prefersReducedMotion ? 0 : 0.3 }}
            className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_28px_90px_-50px_rgba(0,0,0,0.94)] backdrop-blur-xl sm:p-7"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/75">Activity Feed</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Recent Activity</h2>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {recentActivity.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={prefersReducedMotion ? false : { opacity: 0, x: 18 }}
                  animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.55,
                    delay: prefersReducedMotion ? 0 : 0.36 + index * 0.06,
                  }}
                  whileHover={prefersReducedMotion ? undefined : { x: 4 }}
                  className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4 transition-colors duration-300 hover:border-primary/20"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/12 text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-white/58">{item.detail}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">{item.time}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>
      </motion.div>
    </div>
  );
}
