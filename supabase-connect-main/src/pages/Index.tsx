import { useEffect, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Church, ArrowRight, Users, HandCoins, Calendar, BookOpen, Shield, Building2, Sparkles, TrendingUp, HeartHandshake, Activity, CreditCard, BarChart3, CheckCircle2, Smartphone, Check, Crown, Gem, Quote, Star } from "lucide-react";

const features = [
  { icon: CreditCard, title: "Digital Giving", desc: "Accept offerings, tithes, and donations seamlessly" },
  { icon: BarChart3, title: "Smart Reports", desc: "Track finances, attendance, and growth with clarity" },
  { icon: Calendar, title: "Event Management", desc: "Organize church events, services, and special programs" },
  { icon: Users, title: "Member Management", desc: "Manage your congregation with ease and insight" },
];

const howItWorksSteps = [
  {
    icon: Building2,
    step: "01",
    title: "Create Your Church Space",
    desc: "Set up your church profile, teams, and ministry structure in a few guided steps.",
  },
  {
    icon: Users,
    step: "02",
    title: "Add Members and Leaders",
    desc: "Bring your congregation, volunteers, and groups into one organized workspace.",
  },
  {
    icon: Calendar,
    step: "03",
    title: "Run Giving and Events",
    desc: "Launch contributions, attendance, announcements, and upcoming church activities.",
  },
  {
    icon: BarChart3,
    step: "04",
    title: "Track Growth Clearly",
    desc: "Use live dashboards and reports to make confident ministry decisions every week.",
  },
];

const heroStats = [
  {
    icon: Users,
    value: "1,284+",
    label: "active members",
    detail: "Connected across ministries and groups",
  },
  {
    icon: HandCoins,
    value: "$24.8k",
    label: "weekly giving tracked",
    detail: "Transparent contributions with live visibility",
  },
  {
    icon: Calendar,
    value: "12",
    label: "upcoming events",
    detail: "Services, outreach, and follow-up in one place",
  },
];

const previewActivity = [
  {
    title: "+5 new members",
    detail: "Joined this morning",
    accent: "text-emerald-200",
    badgeClass: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  },
  {
    title: "TZS 120,000 collected",
    detail: "Offering synced live",
    accent: "text-primary",
    badgeClass: "border-primary/25 bg-primary/10 text-primary",
  },
];

const ministryHealthBars = [42, 58, 82, 65, 74, 92];
const careTeamBars = [78, 64, 88];

const experiences = [
  { title: "Church Admin", desc: "Full workspace for managing your church operations", url: "/church-admin", icon: Building2 },
  { title: "Member Portal", desc: "Public-facing church experience for members", url: "/portal", icon: Users },
  { title: "Super Admin", desc: "Platform-level management and analytics", url: "/super-admin", icon: Shield },
];

const trustedChurches = [
  "Grace Covenant Church",
  "Redeemed Worship Centre",
  "New Life Cathedral",
  "Hope Chapel Network",
  "Kingdom Harvest Fellowship",
];

const testimonials = [
  {
    quote:
      "Kanisa Connect gave our leadership team one place to manage giving, attendance, and follow-up. It feels premium and deeply practical.",
    name: "Pastor Daniel M.",
    role: "Lead Pastor",
    church: "Grace Covenant Church",
    impact: "42% faster weekly reporting",
  },
  {
    quote:
      "The member experience feels polished from the first tap. Our admins spend less time chasing updates and more time serving people.",
    name: "Rev. Miriam K.",
    role: "Operations Director",
    church: "Hope Chapel Network",
    impact: "3 campuses aligned on one workflow",
  },
  {
    quote:
      "We needed software that matched the dignity of our ministry. Kanisa Connect helped us modernize without losing warmth or clarity.",
    name: "Fr. Joseph A.",
    role: "Parish Administrator",
    church: "New Life Cathedral",
    impact: "Giving visibility improved across every ministry",
  },
];

const pricingPlans = [
  {
    title: "Basic",
    price: "Free",
    features: ["Member management", "Basic reports", "Event tracking"],
    cta: "Get Started",
    href: "/onboarding",
    icon: Shield,
  },
  {
    title: "Pro",
    price: "TZS 70,000 / month",
    features: [
      "Everything in Basic",
      "QR attendance system",
      "Digital giving (M-Pesa, Airtel Money)",
      "Advanced reports",
    ],
    cta: "Start Free Trial",
    href: "/onboarding",
    badge: "Most Popular",
    featured: true,
    icon: Crown,
  },
  {
    title: "Enterprise",
    price: "Custom",
    features: ["All Pro features", "Custom integrations", "Dedicated support"],
    cta: "Contact Us",
    href: "#contact",
    icon: Gem,
  },
];

const sectionLinks = [
  { id: "hero", label: "Home", shortLabel: "01" },
  { id: "features", label: "Features", shortLabel: "02" },
  { id: "how-it-works", label: "How it Works", shortLabel: "03" },
  { id: "preview", label: "Preview", shortLabel: "04" },
  { id: "pricing", label: "Pricing", shortLabel: "05" },
  { id: "faq", label: "FAQ", shortLabel: "06" },
] as const;

const faqs = [
  {
    question: "How quickly can our church get started?",
    answer:
      "Most churches can launch their workspace in a single day. Kanisa Connect is designed to make onboarding simple for admins, leaders, and members without a long technical setup.",
  },
  {
    question: "Can we manage giving, events, and members in one place?",
    answer:
      "Yes. The platform brings together digital giving, attendance, member records, events, announcements, and reporting into one coordinated dashboard.",
  },
  {
    question: "Does Kanisa Connect work for both small churches and growing ministries?",
    answer:
      "It does. The experience is lightweight enough for small teams and structured enough for multi-campus ministries that need stronger visibility and organization.",
  },
  {
    question: "Is there a member-facing experience as well?",
    answer:
      "Yes. Kanisa Connect includes a polished member portal so your congregation can stay connected with updates, events, giving, and key church interactions.",
  },
] as const;

export default function Index() {
  const prefersReducedMotion = useReducedMotion();
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [activeSection, setActiveSection] = useState<(typeof sectionLinks)[number]["id"]>("hero");
  const [isScrolled, setIsScrolled] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [givingAmount, setGivingAmount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 110, damping: 18, mass: 0.5 });
  const smoothY = useSpring(mouseY, { stiffness: 110, damping: 18, mass: 0.5 });
  const motionLimit = prefersReducedMotion ? 0 : isSmallScreen ? 12 : 24;
  const contentTranslateX = useTransform(smoothX, [-motionLimit, motionLimit], [isSmallScreen ? -3 : -8, isSmallScreen ? 3 : 8]);
  const contentTranslateY = useTransform(smoothY, [-motionLimit, motionLimit], [isSmallScreen ? -2 : -6, isSmallScreen ? 2 : 6]);
  const cardRotateY = useTransform(smoothX, [-motionLimit, motionLimit], [isSmallScreen ? -2 : -4, isSmallScreen ? 2 : 4]);
  const cardRotateX = useTransform(smoothY, [-motionLimit, motionLimit], [isSmallScreen ? 2 : 4, isSmallScreen ? -2 : -4]);
  const cardTranslateX = useTransform(smoothX, [-motionLimit, motionLimit], [isSmallScreen ? -5 : -10, isSmallScreen ? 5 : 10]);
  const cardTranslateY = useTransform(smoothY, [-motionLimit, motionLimit], [isSmallScreen ? -4 : -8, isSmallScreen ? 4 : 8]);
  const glowTranslateX = useTransform(smoothX, [-motionLimit, motionLimit], [isSmallScreen ? -10 : -22, isSmallScreen ? 10 : 22]);
  const glowTranslateY = useTransform(smoothY, [-motionLimit, motionLimit], [isSmallScreen ? -8 : -18, isSmallScreen ? 8 : 18]);
  const previewScrollY = useTransform(smoothY, [-motionLimit, motionLimit], [isSmallScreen ? -4 : -10, isSmallScreen ? 4 : 10]);

  const fadeUp = {
    initial: { opacity: 0, y: prefersReducedMotion ? 0 : 40 },
    animate: { opacity: 1, y: 0 },
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const updateScreenState = () => setIsSmallScreen(mediaQuery.matches);

    updateScreenState();
    mediaQuery.addEventListener("change", updateScreenState);

    return () => mediaQuery.removeEventListener("change", updateScreenState);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setMemberCount(1284);
      setGivingAmount(24800);
      setEventCount(12);
      return;
    }

    let animationFrame = 0;
    const duration = 1800;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setMemberCount(Math.round(1284 * eased));
      setGivingAmount(Math.round(24800 * eased));
      setEventCount(Math.round(12 * eased));

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    animationFrame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [prefersReducedMotion]);

  useEffect(() => {
    const updateHeaderState = () => {
      setIsScrolled(window.scrollY > 24);
    };

    updateHeaderState();
    window.addEventListener("scroll", updateHeaderState, { passive: true });

    return () => window.removeEventListener("scroll", updateHeaderState);
  }, []);

  useEffect(() => {
    const updateActiveSection = () => {
      const scrollPosition = window.scrollY + window.innerHeight * 0.34;
      let nextActiveSection = sectionLinks[0].id;

      for (const section of sectionLinks) {
        const element = document.getElementById(section.id);
        if (!element) continue;

        if (scrollPosition >= element.offsetTop) {
          nextActiveSection = section.id;
        }
      }

      setActiveSection((current) => (current === nextActiveSection ? current : nextActiveSection));
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, []);

  const handleHeroMouseMove = (event: MouseEvent<HTMLElement>) => {
    if (prefersReducedMotion) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * motionLimit * 2;
    const offsetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * motionLimit * 2;

    mouseX.set(offsetX);
    mouseY.set(offsetY);
  };

  const resetHeroMouse = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const formattedGivingAmount = new Intl.NumberFormat("en-TZ").format(givingAmount);
  const formattedMemberCount = new Intl.NumberFormat("en-US").format(memberCount);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      <header
        className={[
          "fixed inset-x-0 top-0 z-50 premium-smooth",
          isScrolled ? "bg-background/55 backdrop-blur-2xl shadow-[0_16px_45px_-28px_rgba(0,0,0,0.85)]" : "bg-transparent",
        ].join(" ")}
      >
        <div
          className={[
            "container mx-auto flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:h-16 sm:py-0 premium-smooth",
            isScrolled ? "border-b border-white/8" : "border-b border-transparent",
          ].join(" ")}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 gradient-gold shadow-[0_12px_32px_-18px_rgba(245,158,11,0.95)]">
              <Church className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="truncate text-xl font-bold font-serif text-white">Kanisa Connect</span>
          </div>

          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-2 backdrop-blur-xl lg:flex">
            {sectionLinks.slice(1).map((section) => {
              const isActive = activeSection === section.id;

              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className={[
                    "premium-smooth rounded-full px-4 py-2 text-sm font-medium",
                    isActive ? "bg-primary/14 text-primary shadow-[0_0_24px_rgba(245,158,11,0.12)]" : "text-white/70 hover:bg-white/8 hover:text-white",
                  ].join(" ")}
                >
                  {section.label}
                </a>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="premium-button border border-white/10 bg-white/5 px-3 text-sm text-white backdrop-blur-md hover:bg-white/10 hover:text-white sm:px-4"
              asChild
            >
              <Link to="/login">Sign In</Link>
            </Button>
            <Button
              size="sm"
              className="premium-button h-11 rounded-xl border border-primary/30 px-4 text-sm shadow-[0_16px_40px_-20px_rgba(245,158,11,0.9)] sm:px-5 hover:shadow-[0_20px_50px_-20px_rgba(245,158,11,0.45)]"
              asChild
            >
              <Link to="/onboarding">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <nav
          aria-label="Section navigation"
          className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 lg:block"
        >
          <div className="rounded-[1.8rem] border border-white/10 bg-black/20 px-3 py-4 backdrop-blur-xl shadow-[0_20px_60px_-28px_rgba(0,0,0,0.72)]">
            <div className="flex flex-col items-center gap-3">
              {sectionLinks.map((section) => {
                const isActive = activeSection === section.id;

                return (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    aria-label={section.label}
                    className="group relative flex items-center justify-center"
                  >
                    <span
                      className={[
                        "premium-smooth block rounded-full border",
                        isActive
                          ? "h-4 w-4 border-primary/60 bg-primary shadow-[0_0_26px_rgba(245,158,11,0.4)] scale-110"
                          : "h-3 w-3 border-white/20 bg-white/15 hover:scale-110 hover:border-primary/40 hover:bg-primary/45",
                      ].join(" ")}
                    />
                    <span
                      className={[
                        "pointer-events-none absolute right-full mr-4 whitespace-nowrap rounded-full border px-3 py-1 text-xs uppercase tracking-[0.22em] backdrop-blur-xl transition-all duration-300",
                        isActive
                          ? "border-primary/25 bg-primary/12 text-primary opacity-100 translate-x-0"
                          : "border-white/10 bg-black/35 text-white/65 opacity-0 translate-x-2 group-hover:translate-x-0 group-hover:opacity-100",
                      ].join(" ")}
                    >
                      {section.shortLabel} {section.label}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </nav>

        <section
          id="hero"
          className="relative flex min-h-screen scroll-mt-24 items-center overflow-hidden"
          onMouseMove={handleHeroMouseMove}
          onMouseLeave={resetHeroMouse}
        >
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
          >
            <source src="/church-video.mp4" type="video/mp4" />
          </video>

          <div className="absolute inset-0 bg-black/60" />
          <div className="hero-vignette" />
          <div className="hero-light hero-light-left" />
          <div className="hero-light hero-light-right" />
          <div className="hero-grid-mask opacity-30" />
          <motion.div
            className="hero-gold-glow"
            style={prefersReducedMotion ? undefined : { x: glowTranslateX, y: glowTranslateY }}
          />
          <div className="hero-holy-glow" />
          <div className="hero-holy-glow-secondary" />
          <div className="hero-floating-light" />

          <div className="relative z-10 container mx-auto flex min-h-screen items-center px-4 py-24 sm:py-28">
            <motion.div
              initial="initial"
              animate="animate"
              transition={{ staggerChildren: prefersReducedMotion ? 0 : 0.14, delayChildren: prefersReducedMotion ? 0 : 0.1 }}
              className="grid w-full items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,520px)] lg:gap-10 xl:gap-16"
              >
                <motion.div
                  style={
                    prefersReducedMotion || isSmallScreen
                      ? undefined
                      : {
                          x: contentTranslateX,
                          y: contentTranslateY,
                        }
                  }
                  className="relative flex flex-col items-start text-left"
                >
                  <div className="pointer-events-none absolute -left-8 top-12 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.18),transparent_70%)] blur-3xl" />
                  <div className="pointer-events-none absolute left-28 top-40 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.12),transparent_72%)] blur-3xl" />

                  <motion.div
                    variants={fadeUp}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.8, delay: prefersReducedMotion ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }}
                    className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-black/35 px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] text-primary shadow-[0_0_40px_rgba(245,158,11,0.12)] backdrop-blur-md sm:text-sm"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Premium Church SaaS
                  </motion.div>

                <motion.h1
                  variants={fadeUp}
                  transition={{ duration: prefersReducedMotion ? 0 : 1, delay: prefersReducedMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
                  className="max-w-3xl text-balance text-4xl font-bold font-serif leading-[0.92] text-white sm:text-6xl lg:text-[4.5rem] xl:text-[5rem]"
                >
                  Lead a more connected church with a{" "}
                  <span className="text-gradient-gold">beautiful digital command center</span>
                </motion.h1>

                <motion.p
                  variants={fadeUp}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.95, delay: prefersReducedMotion ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-6 max-w-2xl text-pretty text-base leading-8 text-white/78 sm:text-lg sm:leading-9"
                >
                  Bring members, giving, attendance, events, and ministry workflows into one polished platform your team will actually enjoy using.
                </motion.p>

                <motion.div
                  variants={fadeUp}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.9, delay: prefersReducedMotion ? 0 : 0.52, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-10 flex w-full flex-col items-stretch gap-4 sm:w-auto sm:flex-row sm:items-center"
                >
                  <motion.div whileHover={prefersReducedMotion ? undefined : { scale: isSmallScreen ? 1.02 : 1.05 }} whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}>
                    <Button
                      size="lg"
                      className="premium-button button-premium-glow h-14 rounded-2xl border border-primary/30 px-8 text-base font-semibold text-primary-foreground shadow-[0_20px_55px_-25px_rgba(245,158,11,0.95)] hover:shadow-[0_0_48px_rgba(245,158,11,0.32)]"
                      asChild
                    >
                      <Link to="/onboarding">
                        Start Building Your Church Hub <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </motion.div>

                  <motion.div whileHover={prefersReducedMotion ? undefined : { scale: isSmallScreen ? 1.02 : 1.05 }} whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}>
                    <Button
                      variant="outline"
                      size="lg"
                      className="premium-button h-14 rounded-2xl border-white/50 bg-white/5 px-8 text-base font-semibold text-white backdrop-blur-md hover:border-white hover:bg-white/10 hover:text-white hover:shadow-[0_0_28px_rgba(255,255,255,0.1)]"
                      asChild
                    >
                      <a href="#features">Explore Platform Features</a>
                    </Button>
                  </motion.div>
                </motion.div>

                <motion.div
                  variants={fadeUp}
                  transition={{ duration: prefersReducedMotion ? 0 : 1.05, delay: prefersReducedMotion ? 0 : 0.64, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-10 grid w-full gap-4 sm:grid-cols-3"
                >
                  {heroStats.map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      animate={
                        prefersReducedMotion
                          ? undefined
                          : {
                              y: [0, index % 2 === 0 ? -5 : -8, 0],
                            }
                      }
                      transition={
                        prefersReducedMotion
                          ? undefined
                          : {
                              duration: 4.5 + index * 0.6,
                              delay: index * 0.2,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }
                      }
                      className="premium-card premium-layered-card rounded-[1.35rem] border border-white/10 px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_24px_rgba(245,158,11,0.12)]">
                          <stat.icon className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] uppercase tracking-[0.22em] text-primary/80">Live</span>
                      </div>
                      <p className="mt-4 text-2xl font-semibold text-white">{stat.value}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-primary/85">{stat.label}</p>
                      <p className="mt-3 text-sm leading-6 text-white/68">{stat.detail}</p>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>

                <motion.div
                  variants={fadeUp}
                  transition={{ duration: prefersReducedMotion ? 0 : 1.1, delay: prefersReducedMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
                  style={
                    prefersReducedMotion
                      ? undefined
                    : {
                        rotateX: cardRotateX,
                        rotateY: cardRotateY,
                        x: cardTranslateX,
                        y: cardTranslateY,
                        transformPerspective: 1600,
                      }
                }
                className="mx-auto w-full max-w-[500px] lg:max-w-[540px]"
              >
                <motion.div
                  animate={prefersReducedMotion ? undefined : { y: [0, isSmallScreen ? -5 : -10, 0] }}
                  transition={prefersReducedMotion ? undefined : { duration: isSmallScreen ? 7 : 6, repeat: Infinity, ease: "easeInOut" }}
                  className="premium-panel relative rounded-[1.9rem] border border-white/15 p-4 shadow-[0_30px_90px_-35px_rgba(0,0,0,0.85),0_0_60px_-30px_rgba(245,158,11,0.35)] sm:p-5"
                >
                  <div className="pointer-events-none absolute -inset-px rounded-[1.75rem] border border-primary/20 opacity-80" />
                  <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.02))]" />
                  <div className="relative space-y-4">
                    {!isSmallScreen &&
                      previewActivity.map((item, index) => (
                        <motion.div
                          key={item.title}
                          initial={prefersReducedMotion ? false : { opacity: 0, x: index === 0 ? -18 : 18, y: 8 }}
                          animate={
                            prefersReducedMotion
                              ? undefined
                              : {
                                  opacity: 1,
                                  x: 0,
                                  y: [0, index === 0 ? -8 : -12, 0],
                                }
                          }
                          transition={
                            prefersReducedMotion
                              ? undefined
                              : {
                                  duration: 5 + index,
                                  delay: 0.6 + index * 0.35,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }
                          }
                          className={[
                            "premium-layered-card absolute z-20 hidden max-w-[190px] rounded-2xl border px-3 py-3 lg:block",
                            index === 0 ? "-left-14 top-24 border-emerald-400/15" : "-right-12 bottom-28 border-primary/20",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className={`text-sm font-semibold ${item.accent}`}>{item.title}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${item.badgeClass}`}>
                              Live
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-white/60">{item.detail}</p>
                        </motion.div>
                      ))}

                    <div className="premium-layered-card flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-primary/90">Kanisa Connect Overview</p>
                        <p className="mt-1 text-lg font-semibold text-white">Sunday Dashboard</p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl gradient-gold shadow-[0_16px_32px_-18px_rgba(245,158,11,0.95)]">
                        <Church className="h-5 w-5 text-primary-foreground" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.7, delay: prefersReducedMotion ? 0 : 0.45 }}
                        className="premium-layered-card rounded-2xl border border-white/10 p-4"
                      >
                        <div className="flex items-center justify-between text-white/70">
                          <span className="text-xs uppercase tracking-[0.22em]">Attendance</span>
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <p className="mt-3 text-2xl font-semibold text-white">{formattedMemberCount}</p>
                        <p className="mt-1 text-xs text-emerald-300">+8.4% this month</p>
                      </motion.div>
                      <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.7, delay: prefersReducedMotion ? 0 : 0.55 }}
                        className="premium-layered-card rounded-2xl border border-white/10 p-4"
                      >
                        <div className="flex items-center justify-between text-white/70">
                          <span className="text-xs uppercase tracking-[0.22em]">Giving</span>
                          <TrendingUp className="h-4 w-4 text-primary" />
                        </div>
                        <p className="mt-3 text-2xl font-semibold text-white">TZS {formattedGivingAmount}</p>
                        <p className="mt-1 text-xs text-emerald-300">Steady weekly growth</p>
                      </motion.div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
                      <div className="premium-layered-card rounded-2xl border border-white/10 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-white">Ministry Health</p>
                            <p className="text-xs text-white/55">Weekly engagement snapshot</p>
                          </div>
                          <Activity className="h-4 w-4 text-primary" />
                        </div>
                        <div className="mt-5 flex h-28 items-end gap-2">
                          {ministryHealthBars.map((height, index) => (
                            <motion.div
                              key={height}
                              initial={prefersReducedMotion ? false : { height: 0, opacity: 0.45 }}
                              whileInView={prefersReducedMotion ? undefined : { height: `${height}%`, opacity: 1 }}
                              viewport={{ once: true, amount: 0.7 }}
                              transition={{
                                duration: prefersReducedMotion ? 0 : 0.75,
                                delay: prefersReducedMotion ? 0 : 0.15 + index * 0.08,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              animate={
                                prefersReducedMotion
                                  ? undefined
                                  : {
                                      opacity: [0.82, 1, 0.82],
                                    }
                              }
                              className={[
                                "w-full rounded-t-xl",
                                index === 2 || index === 5
                                  ? "bg-primary/70 shadow-[0_0_18px_rgba(245,158,11,0.28)]"
                                  : index === 3
                                    ? "bg-white/25"
                                    : index === 1
                                      ? "bg-white/20"
                                      : "bg-white/15",
                              ].join(" ")}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="premium-layered-card rounded-2xl border border-white/10 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-white">Events</p>
                            <Calendar className="h-4 w-4 text-primary" />
                          </div>
                          <p className="mt-3 text-2xl font-semibold text-white">{eventCount}</p>
                          <p className="text-xs text-white/60">Upcoming this month</p>
                        </div>

                        <div className="premium-layered-card rounded-2xl border border-white/10 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-white">Care Teams</p>
                            <HeartHandshake className="h-4 w-4 text-primary" />
                          </div>
                          <div className="mt-3 space-y-2">
                            {careTeamBars.map((width, index) => (
                              <div key={width} className="h-2 rounded-full bg-white/10">
                                <motion.div
                                  initial={prefersReducedMotion ? false : { width: 0 }}
                                  whileInView={prefersReducedMotion ? undefined : { width: `${width}%` }}
                                  viewport={{ once: true, amount: 0.8 }}
                                  transition={{
                                    duration: prefersReducedMotion ? 0 : 0.75,
                                    delay: prefersReducedMotion ? 0 : 0.2 + index * 0.1,
                                    ease: [0.22, 1, 0.36, 1],
                                  }}
                                  className={index === 1 ? "h-2 rounded-full bg-white/45" : "h-2 rounded-full bg-primary"}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="premium-layered-card rounded-2xl border border-white/10 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">Recent Activity</p>
                          <p className="text-xs text-white/55">Live platform pulse</p>
                        </div>
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
                          Live
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        <div className="premium-smooth flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5">
                          <span className="text-sm text-white/78">New family registered</span>
                          <span className="text-xs text-white/45">2 min ago</span>
                        </div>
                        <div className="premium-smooth flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5">
                          <span className="text-sm text-white/78">Offering report synced</span>
                          <span className="text-xs text-white/45">12 min ago</span>
                        </div>
                        <div className="premium-smooth flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5">
                          <span className="text-sm text-white/78">Youth event attendance updated</span>
                          <span className="text-xs text-white/45">35 min ago</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-background py-24 sm:py-28">
          <div className="feature-section-glow opacity-80" />
          <div className="feature-section-grid opacity-30" />

          <div className="relative z-10 container mx-auto px-4">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto max-w-6xl"
            >
              <div className="premium-panel rounded-[2rem] border border-white/10 p-6 sm:p-8 lg:p-10">
                <div className="grid gap-10 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-end">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-2 text-xs font-medium uppercase tracking-[0.26em] text-primary sm:text-sm">
                      <Sparkles className="h-3.5 w-3.5" />
                      Social Proof
                    </div>
                    <h2 className="mt-6 text-balance text-4xl font-bold font-serif text-white sm:text-5xl">
                      Trusted by churches building a more connected ministry
                    </h2>
                    <p className="mt-4 max-w-xl text-base leading-8 text-white/68 sm:text-lg sm:leading-9">
                      From parish teams to multi-campus ministries, Kanisa Connect helps leaders move with confidence, clarity, and a premium member experience.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {trustedChurches.map((church, index) => (
                      <motion.div
                        key={church}
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                        whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.4 }}
                        transition={{
                          duration: prefersReducedMotion ? 0 : 0.65,
                          delay: prefersReducedMotion ? 0 : 0.06 * index,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="premium-card premium-layered-card group rounded-[1.35rem] border border-white/10 px-4 py-4 text-center transition-all duration-300 hover:border-primary/30 hover:bg-white/[0.06]"
                      >
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_24px_rgba(245,158,11,0.14)] transition-transform duration-300 group-hover:scale-105">
                          <Church className="h-5 w-5" />
                        </div>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Partner Church</p>
                        <p className="mt-2 text-sm leading-6 text-white/86">{church}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="mt-10 grid gap-5 xl:grid-cols-3">
                  {testimonials.map((testimonial, index) => (
                    <motion.div
                      key={`${testimonial.name}-${testimonial.church}`}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 26 }}
                      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.25 }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.8,
                        delay: prefersReducedMotion ? 0 : 0.08 * index,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      whileHover={prefersReducedMotion ? undefined : { y: -8 }}
                      className="h-full"
                    >
                      <div className="premium-card premium-layered-card relative flex h-full flex-col rounded-[1.6rem] border border-white/10 p-6 hover:border-primary/25 hover:shadow-[0_28px_80px_-36px_rgba(245,158,11,0.22)]">
                        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-primary">
                            {Array.from({ length: 5 }).map((_, starIndex) => (
                              <Star key={starIndex} className="h-4 w-4 fill-current" />
                            ))}
                          </div>
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                            <Quote className="h-5 w-5" />
                          </div>
                        </div>

                        <p className="mt-6 text-base leading-8 text-white/78 sm:text-[17px]">
                          "{testimonial.quote}"
                        </p>

                        <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/10 pt-5">
                          <div>
                            <p className="text-base font-semibold text-white">{testimonial.name}</p>
                            <p className="mt-1 text-sm text-white/58">{testimonial.role}</p>
                            <p className="mt-1 text-sm text-primary/85">{testimonial.church}</p>
                          </div>
                          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-right">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-primary/70">Impact</p>
                            <p className="mt-1 text-sm font-medium text-white/82">{testimonial.impact}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="features" className="relative overflow-hidden scroll-mt-24 bg-background py-24 sm:py-28">
          <div className="feature-section-glow" />
          <div className="feature-section-grid" />

          <div className="relative z-10 container mx-auto px-4">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
              whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mb-12 max-w-3xl text-center sm:mb-16"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-2 text-xs font-medium uppercase tracking-[0.26em] text-primary sm:text-sm">
                <BookOpen className="h-3.5 w-3.5" />
                Platform Features
              </div>
              <h2 className="mt-6 text-balance text-4xl font-bold font-serif text-white sm:text-5xl">
                Everything Your Church Needs
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/68 sm:text-lg sm:leading-9">
                Powerful tools to manage your church with clarity and purpose
              </p>
            </motion.div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 26 }}
                  whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.8,
                    delay: prefersReducedMotion ? 0 : index * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  whileHover={prefersReducedMotion ? undefined : { y: -8 }}
                  className="group"
                >
                  <div className="premium-card premium-layered-card h-full rounded-[1.5rem] border border-white/10 p-6 group-hover:border-primary/30 group-hover:shadow-[0_28px_80px_-36px_rgba(245,158,11,0.28)]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_30px_rgba(245,158,11,0.14)]">
                      <feature.icon className="h-5 w-5" />
                    </div>

                    <h3 className="mt-6 text-xl font-semibold text-white">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-white/66 sm:text-[15px]">
                      {feature.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="relative overflow-hidden scroll-mt-24 bg-background py-24 sm:py-28">
          <div className="feature-section-glow opacity-75" />
          <div className="feature-section-grid opacity-25" />

          <div className="relative z-10 container mx-auto px-4">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
              whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mb-12 max-w-3xl text-center sm:mb-16"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-2 text-xs font-medium uppercase tracking-[0.26em] text-primary sm:text-sm">
                <Sparkles className="h-3.5 w-3.5" />
                How It Works
              </div>
              <h2 className="mt-6 text-balance text-4xl font-bold font-serif text-white sm:text-5xl">
                Start Fast, Stay Organized
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/68 sm:text-lg sm:leading-9">
                A simple four-step flow that helps your church launch with clarity and keep ministry operations running smoothly.
              </p>
            </motion.div>

            <div className="relative mx-auto max-w-6xl">
              <div className="absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent lg:block" />

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                {howItWorksSteps.map((item, index) => (
                  <motion.div
                    key={item.step}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 26 }}
                    whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.8,
                      delay: prefersReducedMotion ? 0 : index * 0.08,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    whileHover={prefersReducedMotion ? undefined : { y: -8 }}
                    className="group relative"
                  >
                    <div className="absolute left-6 top-10 hidden h-3 w-3 -translate-y-1/2 rounded-full border border-primary/40 bg-background shadow-[0_0_0_6px_rgba(245,158,11,0.08)] lg:block" />

                    <div className="premium-card premium-layered-card relative h-full rounded-[1.6rem] border border-white/10 p-6 group-hover:border-primary/30 group-hover:shadow-[0_28px_80px_-36px_rgba(245,158,11,0.24)]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_30px_rgba(245,158,11,0.14)]">
                          <item.icon className="h-6 w-6" />
                        </div>
                        <span className="text-sm font-semibold tracking-[0.24em] text-primary/70">
                          {item.step}
                        </span>
                      </div>

                      <h3 className="mt-6 text-xl font-semibold text-white">{item.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-white/66 sm:text-[15px]">
                        {item.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="preview" className="relative overflow-hidden scroll-mt-24 bg-background py-24 sm:py-28">
          <div className="preview-section-glow" />

          <div className="relative z-10 container mx-auto px-4">
            <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,500px)] lg:gap-16">
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 30 }}
                whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="max-w-2xl"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-2 text-xs font-medium uppercase tracking-[0.26em] text-primary sm:text-sm">
                  <Smartphone className="h-3.5 w-3.5" />
                  App Preview
                </div>
                <h2 className="mt-6 text-balance text-4xl font-bold font-serif text-white sm:text-5xl">
                  See Your Church in Action
                </h2>
                <p className="mt-4 max-w-xl text-base leading-8 text-white/68 sm:text-lg sm:leading-9">
                  A powerful yet simple interface designed for church leaders and members
                </p>

                <div className="mt-8 space-y-4">
                  {[
                    "Track giving in real-time",
                    "Manage members effortlessly",
                    "Monitor attendance and events",
                  ].map((item, index) => (
                    <motion.div
                      key={item}
                      initial={prefersReducedMotion ? false : { opacity: 0, x: -18 }}
                      whileInView={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.7,
                        delay: prefersReducedMotion ? 0 : 0.14 + index * 0.08,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="premium-card premium-layered-card flex items-center gap-3 rounded-2xl border border-white/8 px-4 py-3"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/12 text-primary">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <span className="text-sm text-white/78 sm:text-base">{item}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
                whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.95, ease: [0.22, 1, 0.36, 1] }}
                style={
                  prefersReducedMotion || isSmallScreen
                    ? undefined
                    : {
                        y: previewScrollY,
                      }
                }
                className="mx-auto w-full max-w-[440px]"
              >
                <div className="preview-device-glow" />
                <motion.div
                  animate={prefersReducedMotion ? undefined : { y: [0, -10, 0] }}
                  transition={prefersReducedMotion ? undefined : { duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
                  className="premium-panel relative rounded-[2rem] border border-white/12 p-4 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.88)]"
                >
                  <div className="absolute inset-x-1/2 top-3 h-1.5 w-20 -translate-x-1/2 rounded-full bg-white/18" />
                  <div className="premium-layered-card mt-5 rounded-[1.6rem] border border-white/10 p-4 sm:p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-primary/85">Church App</p>
                        <p className="mt-1 text-lg font-semibold text-white">Dashboard</p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl gradient-gold">
                        <Church className="h-5 w-5 text-primary-foreground" />
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="premium-layered-card rounded-2xl border border-white/10 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/52">Total Giving</p>
                        <p className="mt-2 text-xl font-semibold text-white">$18.4k</p>
                      </div>
                      <div className="premium-layered-card rounded-2xl border border-white/10 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/52">Members</p>
                        <p className="mt-2 text-xl font-semibold text-white">1,284</p>
                      </div>
                      <div className="premium-layered-card rounded-2xl border border-white/10 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/52">Attendance</p>
                        <p className="mt-2 text-xl font-semibold text-white">92%</p>
                      </div>
                      <div className="premium-layered-card rounded-2xl border border-white/10 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Events</p>
                        <p className="mt-2 text-xl font-semibold text-white">14</p>
                      </div>
                    </div>

                    <div className="premium-layered-card mt-5 rounded-2xl border border-white/10 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white">Growth Snapshot</p>
                        <span className="text-xs text-primary">This Month</span>
                      </div>
                      <div className="mt-4 flex h-28 items-end gap-2">
                        <div className="w-full rounded-t-xl bg-white/10" style={{ height: "38%" }} />
                        <div className="w-full rounded-t-xl bg-white/15" style={{ height: "52%" }} />
                        <div className="w-full rounded-t-xl bg-primary/65" style={{ height: "68%" }} />
                        <div className="w-full rounded-t-xl bg-white/20" style={{ height: "56%" }} />
                        <div className="w-full rounded-t-xl bg-primary/45" style={{ height: "84%" }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="pricing" className="relative overflow-hidden scroll-mt-24 bg-background py-24 sm:py-28">
          <div className="pricing-section-glow" />
          <div className="feature-section-grid opacity-25" />

          <div className="relative z-10 container mx-auto px-4">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
              whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mb-12 max-w-3xl text-center sm:mb-16"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-2 text-xs font-medium uppercase tracking-[0.26em] text-primary sm:text-sm">
                <HandCoins className="h-3.5 w-3.5" />
                Pricing
              </div>
              <h2 className="mt-6 text-balance text-4xl font-bold font-serif text-white sm:text-5xl">
                Simple, Transparent Pricing
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/68 sm:text-lg sm:leading-9">
                Choose a plan that fits your church
              </p>
            </motion.div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {pricingPlans.map((plan, index) => (
                <motion.div
                  key={plan.title}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 30 }}
                  whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.8,
                    delay: prefersReducedMotion ? 0 : index * 0.1,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  whileHover={prefersReducedMotion ? undefined : { y: -8 }}
                  className={plan.featured ? "lg:-mt-4" : ""}
                >
                  <div
                    className={[
                      "premium-card premium-layered-card relative h-full rounded-[1.8rem] border p-6 transition-all duration-300",
                      plan.featured
                        ? "border-primary/40 shadow-[0_28px_90px_-38px_rgba(245,158,11,0.3)]"
                        : "border-white/10 hover:border-primary/20 hover:shadow-[0_28px_80px_-36px_rgba(245,158,11,0.18)]",
                    ].join(" ")}
                  >
                    {plan.badge ? (
                      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/30 bg-primary px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground shadow-[0_12px_35px_-18px_rgba(245,158,11,0.95)]">
                        {plan.badge}
                      </div>
                    ) : null}

                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_30px_rgba(245,158,11,0.14)]">
                      <plan.icon className="h-5 w-5" />
                    </div>

                    <div className="mt-6">
                      <h3 className="text-2xl font-semibold text-white">{plan.title}</h3>
                      <p className="mt-3 text-3xl font-bold font-serif text-white">{plan.price}</p>
                    </div>

                    <div className="mt-8 space-y-3">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-3 text-white/72">
                          <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/12 text-primary">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm leading-6">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      size="lg"
                      className={[
                        "premium-button mt-10 h-13 w-full rounded-2xl text-base font-semibold",
                        plan.featured
                          ? "button-premium-glow border border-primary/30 shadow-[0_18px_40px_-20px_rgba(245,158,11,0.95)] hover:shadow-[0_0_48px_rgba(245,158,11,0.4)]"
                          : "border border-white/12 bg-white/5 text-white hover:bg-white/10",
                      ].join(" ")}
                      variant={plan.featured ? "default" : "outline"}
                      asChild
                    >
                      <Link to={plan.href}>{plan.cta}</Link>
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="relative overflow-hidden scroll-mt-24 bg-background py-24 sm:py-28">
          <div className="feature-section-glow opacity-70" />
          <div className="feature-section-grid opacity-20" />

          <div className="relative z-10 container mx-auto px-4">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto max-w-4xl"
            >
              <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-2 text-xs font-medium uppercase tracking-[0.26em] text-primary sm:text-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  FAQ
                </div>
                <h2 className="mt-6 text-balance text-4xl font-bold font-serif text-white sm:text-5xl">
                  Questions, Clearly Answered
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/68 sm:text-lg sm:leading-9">
                  Everything your team needs to know before launching a more premium church experience.
                </p>
              </div>

              <div className="premium-panel rounded-[2rem] border border-white/10 p-4 sm:p-6">
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((item) => (
                    <AccordionItem
                      key={item.question}
                      value={item.question}
                      className="border-b border-white/10 px-3 py-1 last:border-b-0 sm:px-5"
                    >
                      <AccordionTrigger className="premium-smooth text-left text-base font-semibold text-white hover:text-primary">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="pb-5 pr-8 text-sm leading-7 text-white/68 sm:text-[15px]">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="relative overflow-hidden py-24 sm:py-28">
          <div className="cta-section-backdrop" />
          <div className="cta-section-glow" />

          <div className="relative z-10 container mx-auto px-4">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
              whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="premium-panel mx-auto max-w-4xl rounded-[2rem] border border-white/10 px-6 py-14 text-center shadow-[0_30px_120px_-60px_rgba(0,0,0,0.95)] sm:px-10 sm:py-16"
            >
              <h2 className="text-balance text-4xl font-bold font-serif text-white sm:text-5xl">
                Lead Your Church With Clarity and Purpose
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/72 sm:text-lg sm:leading-9">
                Start your digital transformation today and empower your ministry
              </p>

              <motion.div
                whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                className="mt-10 inline-flex"
              >
                <Button
                  size="lg"
                  className="premium-button button-premium-glow h-14 rounded-2xl border border-primary/30 px-9 text-base font-semibold shadow-[0_22px_55px_-22px_rgba(245,158,11,0.95)] hover:shadow-[0_0_52px_rgba(245,158,11,0.36)]"
                  asChild
                >
                  <Link to="/onboarding">
                    Get Started Now <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <motion.section
          initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.85, ease: [0.22, 1, 0.36, 1] }}
          className="container mx-auto px-4 pb-24"
        >
          <h2 className="mb-8 text-center text-2xl font-bold font-serif">Explore the Platform</h2>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
            {experiences.map((e) => (
              <Link key={e.title} to={e.url}>
                <div className="premium-card premium-layered-card glass-card group space-y-3 rounded-xl p-6 text-center hover:gold-glow">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl gradient-gold premium-smooth">
                    <e.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h3 className="premium-smooth font-semibold font-sans group-hover:text-primary">{e.title}</h3>
                  <p className="text-sm text-muted-foreground">{e.desc}</p>
                  <span className="premium-smooth inline-flex items-center text-xs text-primary">
                    Open <ArrowRight className="ml-1 h-3 w-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </motion.section>
      </main>

      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Kanisa Connect. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
