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
              transform="translate(12 12) translate(-12 -12)"
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

export function CommunityDashboardIcon(props: IconProps) {
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

export function CommunityMembersIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "circle", cx: 12, cy: 9, r: 3.2 }]}
      strokes={[
        { d: "M12 12.2c-3.35 0-6.4 1.82-7.5 4.8" },
        { d: "M19.5 17c-1.1-2.98-4.15-4.8-7.5-4.8" },
        { d: "M9.1 8.8a2.9 2.9 0 1 0 5.8 0a2.9 2.9 0 1 0-5.8 0" },
      ]}
    />
  );
}

export function CommunityContributionsIcon(props: IconProps) {
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

export function CommunityPledgesIcon(props: IconProps) {
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

export function CommunityReportsIcon(props: IconProps) {
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

export function CommunityChannelsIcon(props: IconProps) {
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

export function CommunityLeadershipIcon(props: IconProps) {
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

export function CommunityHomeIcon(props: IconProps) {
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

export function CommunityBuildingIcon(props: IconProps) {
  return (
    <PremiumIcon
      {...props}
      fills={[{ type: "rect", x: 5, y: 4.5, width: 14, height: 15, rx: 3 }]}
      strokes={[
        { d: "M9 19v-4.2c0-1 .8-1.8 1.8-1.8h2.4c1 0 1.8.8 1.8 1.8V19" },
        { d: "M7.4 8.2h.01" },
        { d: "M11.2 8.2h.01" },
        { d: "M15 8.2h.01" },
        { d: "M7.4 11.3h.01" },
        { d: "M11.2 11.3h.01" },
        { d: "M15 11.3h.01" },
      ]}
    />
  );
}
