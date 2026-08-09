import { Church } from "lucide-react";

type DashboardGreetingProps = {
  memberName: string;
  churchName: string | null;
};

export function DashboardGreeting({ memberName, churchName }: DashboardGreetingProps) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.15),hsl(var(--card))_58%,hsl(var(--card)))] p-5 shadow-sm sm:p-7">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Church className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">Karibu</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{memberName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {churchName ? churchName : "Huduma yako ya kanisa iko hapa kwa urahisi."}
          </p>
        </div>
      </div>
    </section>
  );
}
