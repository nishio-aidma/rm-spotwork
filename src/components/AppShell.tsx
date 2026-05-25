"use client";

import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
