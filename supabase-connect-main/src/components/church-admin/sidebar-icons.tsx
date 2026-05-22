import { motion } from "framer-motion";

type IconProps = {
  active?: boolean;
  className?: string;
};

type StrokePath = {
  d: string;
};

type FillShape =
  | { type: "rect"; x: number; y: number; width: number; height: number; rx?: number }
  | { type: "circle"; cx: number; cy: number; r: number }
  | { type: "path"; d: string };

const iconTransition = {
  type: "spring",
  stiffness: 220,
  damping: 24,
};

function drawTransition(index: number) {
  return {
    duration: 0.5,
    ease: [0.22, 1, 0.36, 1] as const,
    delay: index * 0.04,
  };
}

function PremiumIcon({
  active = false,
  className,
  strokes,
  fills = [],
}: IconProps & { strokes: StrokePath[]; fills?: FillShape[] }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      initial={false}
      animate={{ scale: active ? 1.04 : 1 }}
      transition={iconTransition}
    >
      {fills.map((shape, index) => {
        if (shape.type === "rect") {
          return (
            <motion.rect
              key={`fill-rect-${index}`}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
              rx={shape.rx}
              fill="currentColor"
              initial={false}
              animate={{
                opacity: active ? 0.18 : 0,
                scale: active ? 1 : 0.82,
              }}
              transform={`translate(12 12) translate(-12 -12)`}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        }

        if (shape.type === "circle") {
          return (
            <motion.circle
              key={`fill-circle-${index}`}
              cx={shape.cx}
              cy={shape.cy}
              r={shape.r}
              fill="currentColor"
              initial={false}
              animate={{
                opacity: active ? 0.18 : 0,
                scale: active ? 1 : 0.82,
              }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        }

        return (
          <motion.path
            key={`fill-path-${index}`}
            d={shape.d}
            fill="currentColor"
            initial={false}
            animate={{
              opacity: active ? 0.18 : 0,
              scale: active ? 1 : 0.82,
            }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          />
        );
      })}

      {strokes.map((path, index) => (
        <motion.path
          key={`stroke-${index}`}
          d={path.d}
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0.52 }}
          animate={{
            pathLength: 1,
            opacity: active ? 1 : 0.9,
          }}
          transition={drawTransition(index)}
        />
      ))}
    </motion.svg>
  );
}

export function DashboardIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "rect", x: 4, y: 4, width: 16, height: 16, rx: 4 }]}
      strokes={[
        { d: "M5 5.5h6.5v6.5H5z" },
        { d: "M12.5 5.5H19v4.5h-6.5z" },
        { d: "M12.5 11.5H19v7H12.5z" },
        { d: "M5 13.5h6.5v5H5z" },
      ]}
    />
  );
}

export function MembersIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "circle", cx: 12, cy: 9, r: 3.2 }]}
      strokes={[
        { d: "M12 12.2c-3.35 0-6.4 1.82-7.5 4.8" },
        { d: "M19.5 17c-1.1-2.98-4.15-4.8-7.5-4.8" },
        { d: "M9.1 8.8a2.9 2.9 0 1 0 5.8 0a2.9 2.9 0 1 0-5.8 0" },
        { d: "M17.5 7.8c1.1.12 2 1.06 2 2.2s-.9 2.08-2 2.2" },
      ]}
    />
  );
}

export function ContributionsIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "path", d: "M12 3.8l5.6 6.02A4.6 4.6 0 0 1 12 19.4a4.6 4.6 0 0 1-5.6-9.58L12 3.8Z" }]}
      strokes={[
        { d: "M12 4.5l5.1 5.5A4.18 4.18 0 0 1 12 18.9A4.18 4.18 0 0 1 6.9 10L12 4.5Z" },
        { d: "M10.2 12.2c.52.6 1.08.88 1.8.88c.86 0 1.52-.42 1.52-1.15c0-.63-.44-.96-1.66-1.26c-1.28-.3-1.9-.82-1.9-1.7c0-.96.82-1.72 2.02-1.72c.78 0 1.36.22 1.88.72" },
        { d: "M12 7.15v7.1" },
      ]}
    />
  );
}

export function PledgesIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "circle", cx: 12, cy: 12, r: 7.5 }]}
      strokes={[
        { d: "M12 4.5v15" },
        { d: "M4.5 12h15" },
        { d: "M7.2 7.2l9.6 9.6" },
        { d: "M16.8 7.2l-9.6 9.6" },
      ]}
    />
  );
}

export function CommunitiesIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "rect", x: 4.5, y: 5, width: 15, height: 14, rx: 3 }]}
      strokes={[
        { d: "M7 18.5v-5.2c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v5.2" },
        { d: "M6 8.5l6-4l6 4" },
        { d: "M9.2 18.5V15h5.6v3.5" },
      ]}
    />
  );
}

export function MinistriesIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "path", d: "M12 5c2.8 0 5.1 2.26 5.1 5.06c0 2.05-1.27 3.76-2.57 5.07c-.76.76-1.52 1.45-2.08 2.37c-.17.27-.56.27-.73 0c-.56-.92-1.32-1.61-2.08-2.37c-1.3-1.31-2.57-3.02-2.57-5.07C6.9 7.26 9.2 5 12 5Z" }]}
      strokes={[
        { d: "M12 5c2.8 0 5.1 2.26 5.1 5.06c0 2.05-1.27 3.76-2.57 5.07c-.76.76-1.52 1.45-2.08 2.37c-.17.27-.56.27-.73 0c-.56-.92-1.32-1.61-2.08-2.37c-1.3-1.31-2.57-3.02-2.57-5.07C6.9 7.26 9.2 5 12 5Z" },
        { d: "M9.75 10.15h4.5" },
        { d: "M12 7.9v4.5" },
      ]}
    />
  );
}

export function FamiliesIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "rect", x: 5, y: 6, width: 14, height: 12.5, rx: 3 }]}
      strokes={[
        { d: "M8.4 10.2a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0" },
        { d: "M13.9 9.3a1.35 1.35 0 1 0 2.7 0a1.35 1.35 0 1 0-2.7 0" },
        { d: "M6.8 16c.45-1.64 1.92-2.8 3.8-2.8c1.88 0 3.35 1.16 3.8 2.8" },
        { d: "M14.3 16c.22-.88.96-1.48 1.95-1.48c.84 0 1.47.42 1.75 1.1" },
      ]}
    />
  );
}

export function EventsIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "rect", x: 4.5, y: 5.5, width: 15, height: 13.5, rx: 3 }]}
      strokes={[
        { d: "M7.5 4.8v3.2" },
        { d: "M16.5 4.8v3.2" },
        { d: "M4.8 9h14.4" },
        { d: "M8 12.4h3.4" },
        { d: "M8 15.4h7.2" },
      ]}
    />
  );
}

export function EventRequestIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "rect", x: 5, y: 4.5, width: 12.5, height: 15, rx: 3 }]}
      strokes={[
        { d: "M8.2 8.4h6" },
        { d: "M8.2 11.8h4.4" },
        { d: "M8.2 15.2h5.4" },
        { d: "M18.2 15.3l1.55 1.58L22 14.65" },
      ]}
    />
  );
}

export function AnnouncementsIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "path", d: "M6.3 10.2l8.9-3.75v10.65L6.3 13.35V10.2Z" }]}
      strokes={[
        { d: "M6.3 10.2l8.9-3.75v10.65L6.3 13.35V10.2Z" },
        { d: "M15.2 8.05h1.55a2.25 2.25 0 0 1 0 4.5H15.2" },
        { d: "M7.3 13.1L8.45 18h2.35l-.86-3.9" },
      ]}
    />
  );
}

export function SermonsIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "rect", x: 5, y: 4.5, width: 14, height: 15, rx: 2.5 }]}
      strokes={[
        { d: "M8 7.8h8" },
        { d: "M8 11.2h8" },
        { d: "M8 14.6h5.8" },
        { d: "M5 6.4c1.2-.9 2.2-1.15 3.4-.8" },
      ]}
    />
  );
}

export function BibleIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "rect", x: 5, y: 4.5, width: 14, height: 15, rx: 2.5 }]}
      strokes={[
        { d: "M9 7.3v9.4" },
        { d: "M7.1 9.3h3.8" },
        { d: "M13.2 8.2h3.2" },
        { d: "M13.2 11.8h3.8" },
        { d: "M13.2 15.2h2.8" },
      ]}
    />
  );
}

export function PrayerIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "path", d: "M8.4 7.2c.9-1.22 2.15-1.82 3.6-1.82c1.44 0 2.7.6 3.6 1.82c1.76 2.38.85 5.12-.6 6.76L12 18.2l-2.98-4.22c-1.45-1.64-2.36-4.38-.62-6.76Z" }]}
      strokes={[
        { d: "M8.4 7.2c.9-1.22 2.15-1.82 3.6-1.82c1.44 0 2.7.6 3.6 1.82c1.76 2.38.85 5.12-.6 6.76L12 18.2l-2.98-4.22c-1.45-1.64-2.36-4.38-.62-6.76Z" },
        { d: "M10.35 9.4h3.3" },
        { d: "M12 7.75v3.3" },
      ]}
    />
  );
}

export function MassIntentionsIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "circle", cx: 12, cy: 12, r: 7.3 }]}
      strokes={[
        { d: "M12 6.8v10.4" },
        { d: "M8.6 10.2h6.8" },
        { d: "M9.25 17.1c.62-1.62 1.56-2.84 2.75-3.78c1.19.94 2.13 2.16 2.75 3.78" },
      ]}
    />
  );
}

export function CommunityHelpIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "rect", x: 5, y: 5.5, width: 14, height: 13.5, rx: 3 }]}
      strokes={[
        { d: "M9.1 10.2a2.9 2.9 0 1 1 5.8 0c0 1.75-1.45 2.4-2.2 3.15c-.28.28-.42.58-.42 1" },
        { d: "M12 17.55h.02" },
      ]}
    />
  );
}

export function ReportsIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "rect", x: 5, y: 4.5, width: 14, height: 15, rx: 2.5 }]}
      strokes={[
        { d: "M8 8.2h8" },
        { d: "M8 11.8h8" },
        { d: "M8 15.4h5.4" },
        { d: "M15.4 4.8v3.5h3.3" },
      ]}
    />
  );
}

export function AnalyticsIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "rect", x: 4.5, y: 5, width: 15, height: 14, rx: 3 }]}
      strokes={[
        { d: "M7.5 15.8v-3.4" },
        { d: "M12 15.8V9.6" },
        { d: "M16.5 15.8V7.2" },
        { d: "M6.2 8.8L9.6 6.9l2.45 1.85l4.2-3.05" },
      ]}
    />
  );
}

export function AssistantIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "rect", x: 4.8, y: 5, width: 14.4, height: 14, rx: 3 }]}
      strokes={[
        { d: "M8.2 10.2h7.6" },
        { d: "M9.4 14.2h5.2" },
        { d: "M12 5.2v2.1" },
        { d: "M8.1 18.1l1.4-2.1h5l1.4 2.1" },
        { d: "M7.2 7.8l-1.3-1.3" },
        { d: "M16.8 7.8l1.3-1.3" },
      ]}
    />
  );
}

export function ImportIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "rect", x: 5, y: 6.5, width: 14, height: 12, rx: 3 }]}
      strokes={[
        { d: "M12 5v8.2" },
        { d: "M8.8 9.8L12 13l3.2-3.2" },
        { d: "M7 18.2h10" },
      ]}
    />
  );
}

export function AuditIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "rect", x: 5, y: 4.8, width: 14, height: 14.4, rx: 3 }]}
      strokes={[
        { d: "M8.2 8.2h7.6" },
        { d: "M8.2 12h7.6" },
        { d: "M8.2 15.8h4.5" },
        { d: "M15.7 15.5l1.25 1.25L19.5 14.2" },
      ]}
    />
  );
}

export function BillingIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "rect", x: 4.5, y: 6, width: 15, height: 12, rx: 3 }]}
      strokes={[
        { d: "M4.8 9.2h14.4" },
        { d: "M8 14h3.5" },
        { d: "M14.2 14h2.2" },
      ]}
    />
  );
}

export function ChannelsIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "circle", cx: 12, cy: 12, r: 7.3 }]}
      strokes={[
        { d: "M8.6 11.2h6.8" },
        { d: "M8.6 14.4h4.3" },
        { d: "M8.6 8h6.8" },
      ]}
    />
  );
}

export function NotificationIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "path", d: "M12 5.2c2.64 0 4.55 1.86 4.55 4.95v2.2c0 .6.23 1.18.64 1.6l.86.9H5.95l.86-.9c.41-.42.64-1 .64-1.6v-2.2c0-3.1 1.91-4.95 4.55-4.95Z" }]}
      strokes={[
        { d: "M12 5.2c2.64 0 4.55 1.86 4.55 4.95v2.2c0 .6.23 1.18.64 1.6l.86.9H5.95l.86-.9c.41-.42.64-1 .64-1.6v-2.2c0-3.1 1.91-4.95 4.55-4.95Z" },
        { d: "M10 17.25a2.15 2.15 0 0 0 4 0" },
      ]}
    />
  );
}

export function RolesIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "path", d: "M12 4.7l5.3 2v4.35c0 3.3-2.02 6.22-5.3 8.22c-3.28-2-5.3-4.92-5.3-8.22V6.7l5.3-2Z" }]}
      strokes={[
        { d: "M12 4.7l5.3 2v4.35c0 3.3-2.02 6.22-5.3 8.22c-3.28-2-5.3-4.92-5.3-8.22V6.7l5.3-2Z" },
        { d: "M10.1 12.2l1.35 1.35l2.55-2.95" },
      ]}
    />
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "circle", cx: 12, cy: 12, r: 6.7 }]}
      strokes={[
        { d: "M12 7.8v-2.3" },
        { d: "M12 18.5v-2.3" },
        { d: "M8.35 9.35L6.7 7.7" },
        { d: "M17.3 16.3l-1.65-1.65" },
        { d: "M7.8 12H5.5" },
        { d: "M18.5 12h-2.3" },
        { d: "M8.35 14.65L6.7 16.3" },
        { d: "M17.3 7.7l-1.65 1.65" },
        { d: "M10.15 12a1.85 1.85 0 1 0 3.7 0a1.85 1.85 0 1 0-3.7 0" },
      ]}
    />
  );
}

export function PortalIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "rect", x: 4.8, y: 5, width: 14.4, height: 14, rx: 3 }]}
      strokes={[
        { d: "M10.6 8.2L7.4 11.4l3.2 3.2" },
        { d: "M13.4 8.2l3.2 3.2l-3.2 3.2" },
        { d: "M11.2 17.2h1.6" },
      ]}
    />
  );
}
