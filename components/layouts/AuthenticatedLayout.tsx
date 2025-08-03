"use client";

import Loading from "@/app/chat/[id]/loading";
import { AppSidebar } from "@/app/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return <Loading />;
  }

  if (!session) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "22rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="flex-1 h-screen overflow-hidden">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
