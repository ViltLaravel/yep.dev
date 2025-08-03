"use client";

import * as React from "react";
import { LucideAlignLeft, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useEffect, useState } from "react";
import { Conversation } from "@/lib/services/conversationService";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function AppDrawer() {
  const [isLoading, setIsLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const activeId = pathname?.split("/").pop();

  useEffect(() => {
    async function fetchConversations() {
      try {
        const response = await fetch("/api/conversations");

        if (!response.ok) {
          throw new Error("Failed to fetch conversations");
        }

        const data = await response.json();
        setConversations(data.conversations || []);
      } catch (error) {
        console.error("Error fetching conversations:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchConversations();
  }, []);

  const handleConversationClick = (conversationId: string) => {
    router.push(`/chat/${conversationId}`);
  };

  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>
        <Button
          className="h-16 bg-transparent hover:bg-transparent p-0"
          variant="ghost"
        >
          <LucideAlignLeft size={15} />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="mx-auto w-full text-gray-400 max-w-sm bg-black">
        <div className="w-full">
          <DrawerHeader>
            <DrawerTitle />
            <DrawerDescription>Recent Conversations</DrawerDescription>
          </DrawerHeader>
          <div>
            {isLoading ? (
              <p className="p-4 text-sm text-gray-400">
                Loading conversations...
              </p>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">
                No conversations found
              </p>
            ) : (
              <div className="flex flex-col w-full gap-1">
                {conversations.map((conversation) => (
                  <div key={conversation.id} className="p-1 w-full">
                    <Button
                      variant="ghost"
                      onClick={() => handleConversationClick(conversation.id)}
                      className={`w-full text-gray-400 hover:text-black hover:bg-gray-200 flex justify-start items-center bg-transparent ${
                        activeId === conversation.id &&
                        "bg-gray-200 text-black rounded-md"
                      }`}
                    >
                      <div
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        className="pl-3 pt-1.5"
                      >
                        {conversation.title || "Untitled Chat"}
                      </div>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
