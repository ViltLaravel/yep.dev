"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  BadgeCheck,
  LogOut,
  Sparkles,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { IoSettingsOutline } from "react-icons/io5"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
    isSubscribed?: boolean
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);

  useEffect(() => {
    async function fetchCredits() {
      setLoadingCredits(true);
      try {
        const res = await fetch("/api/user/credits");
        if (res.ok) {
          const data = await res.json();
          setCreditBalance(data.credits);
        }
      } catch {}
      setLoadingCredits(false);
    }
    fetchCredits();
  }, [user.email]);

  const handleSubscription = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
      })
      const data = await response.json()

      if (data.url) {
        router.push(data.url)
      }
    } catch (error) {
      console.error("Error creating checkout session:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBuyCredits = async () => {
    const credits = window.prompt("How many credits do you want to purchase?");
    const creditsNum = Number(credits);
    if (!creditsNum || creditsNum <= 0) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: creditsNum }),
      });
      const data = await res.json();
      if (data.url) {
        router.push(data.url);
      }
    } catch (error) {
      alert("Failed to start checkout");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          {/* Show credit balance and buy button */}
          <div className="flex items-center gap-2 px-2 py-1">
            <span className="text-xs text-gray-400">Credits:</span>
            <span className="font-bold text-sm text-blue-400">
              {loadingCredits ? '...' : creditBalance ?? '0'}
            </span>
            <button
              className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={handleBuyCredits}
              disabled={isLoading}
            >
              Buy Credits
            </button>
          </div>
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="flex justify-center"
              >
                <IoSettingsOutline />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={handleSubscription}
                  disabled={isLoading || user.isSubscribed}
                >
                  <Sparkles />
                  {user.isSubscribed ? "Subscribed" : "Upgrade to Pro"}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {/* Removed Update API Keys menu item */}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut({
                callbackUrl: "/login",
                redirect: true,
              })}>
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      {/* Removed ModalUpdateApiKeys modal */}
    </>
  )
}
