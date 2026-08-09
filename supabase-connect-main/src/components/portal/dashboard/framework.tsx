import { Fragment, useId, type ReactNode } from "react";

export type DashboardRole = "member" | "priest" | "church_admin" | "finance" | "super_admin";
export type DashboardSectionIcon = (props: { className?: string }) => ReactNode;

export type DashboardWidgetVisibility<TContext> = boolean | ((context: TContext) => boolean);

export type DashboardWidgetLayout = {
  className?: string;
};

export type DashboardWidgetSlot<TContext> = {
  id: string;
  visible?: DashboardWidgetVisibility<TContext>;
  layout?: DashboardWidgetLayout;
};

export type DashboardSectionConfig<TContext = unknown> = {
  id: string;
  title: string;
  description?: string;
  icon?: DashboardSectionIcon;
  widgets: DashboardWidgetSlot<TContext>[];
  showHeader?: boolean;
  className?: string;
};

export type DashboardConfig<TContext = unknown> = {
  role: DashboardRole;
  sections: DashboardSectionConfig<TContext>[];
};

export type DashboardWidget<TContext = unknown> = {
  id: string;
  render: (context: TContext) => ReactNode;
};

type DashboardGridProps = {
  children: ReactNode;
  className?: string;
};

export function DashboardGrid({ children, className = "space-y-5" }: DashboardGridProps) {
  return <div className={className}>{children}</div>;
}

type SectionHeaderProps = {
  headingId?: string;
  title: string;
  description?: string;
  icon?: DashboardSectionIcon;
};

export function SectionHeader({ headingId, title, description, icon: Icon }: SectionHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      {Icon ? (
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <div className="min-w-0">
        <h2 id={headingId} className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}

type WidgetRendererProps<TContext> = {
  context: TContext;
  slot: DashboardWidgetSlot<TContext>;
  widget?: DashboardWidget<TContext>;
};

function WidgetRenderer<TContext>({ context, slot, widget }: WidgetRendererProps<TContext>) {
  if (!widget) return null;

  const isVisible = typeof slot.visible === "function" ? slot.visible(context) : slot.visible ?? true;
  if (!isVisible) return null;

  const content = widget.render(context);
  if (!content) return null;

  return slot.layout?.className ? (
    <div className={slot.layout.className}>{content}</div>
  ) : (
    <>{content}</>
  );
}

type DashboardSectionRendererProps<TContext> = {
  context: TContext;
  section: DashboardSectionConfig<TContext>;
  widgets: Record<string, DashboardWidget<TContext>>;
};

export function DashboardSectionRenderer<TContext>({
  context,
  section,
  widgets,
}: DashboardSectionRendererProps<TContext>) {
  const headingId = useId();
  const renderedWidgets = section.widgets.map((slot) => (
    <WidgetRenderer key={slot.id} context={context} slot={slot} widget={widgets[slot.id]} />
  ));

  if (section.showHeader === false) {
    return <Fragment>{renderedWidgets}</Fragment>;
  }

  return (
    <section className={section.className ?? "space-y-3"} aria-labelledby={headingId}>
      <SectionHeader headingId={headingId} title={section.title} description={section.description} icon={section.icon} />
      <div className="space-y-5">{renderedWidgets}</div>
    </section>
  );
}

type DashboardRendererProps<TContext> = {
  config: DashboardConfig<TContext>;
  context: TContext;
  widgets: Record<string, DashboardWidget<TContext>>;
  className?: string;
};

export function DashboardRenderer<TContext>({
  config,
  context,
  widgets,
  className,
}: DashboardRendererProps<TContext>) {
  return (
    <DashboardGrid className={className}>
      {config.sections.map((section) => (
        <DashboardSectionRenderer
          key={section.id}
          context={context}
          section={section}
          widgets={widgets}
        />
      ))}
    </DashboardGrid>
  );
}
