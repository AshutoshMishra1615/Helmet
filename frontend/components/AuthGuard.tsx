"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/register"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const loggedIn = isLoggedIn();
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

    if (!loggedIn && !isPublic) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [pathname, router]);

  if (!checked && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
