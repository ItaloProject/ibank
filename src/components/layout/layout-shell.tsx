"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ibank_sidebar");
    if (saved === "collapsed") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("ibank_sidebar", next ? "collapsed" : "open");
      return next;
    });
  }

  return (
    <div className="flex h-screen">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <main
        className="flex-1 overflow-y-auto bg-background transition-all duration-300"
        style={{ marginLeft: collapsed ? 64 : 256 }}
      >
        {children}
      </main>
    </div>
  );
}
