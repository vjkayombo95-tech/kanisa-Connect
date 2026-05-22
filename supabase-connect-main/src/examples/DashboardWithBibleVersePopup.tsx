"use client";

import BibleVersePopup from "@/components/BibleVersePopup";

type DashboardUser = {
  name: string;
  role: "admin" | "pastor" | "member";
};

export default function DashboardPage() {
  // Example user (replace with your auth/session user object)
  const user: DashboardUser = {
    name: "John",
    role: "admin",
  };

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <BibleVersePopup user={user} />

      <section className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold">Church Dashboard</h1>
        <p className="mt-2 text-slate-300">Your dashboard content goes here.</p>
      </section>
    </main>
  );
}
