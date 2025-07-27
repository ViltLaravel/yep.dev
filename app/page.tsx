"use client";

import { AuthenticatedLayout } from "@/components/layouts/AuthenticatedLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { Textarea } from "@/components/ui/textarea";
import { UploadedImage, useImageUpload } from "@/hooks/useImageUpload";
import { usePromptEnhancer } from "@/hooks/usePromptEnhancer";
import {
  DEFAULT_MODEL,
  DEFAULT_TEMPLATE,
  STARTER_TEMPLATES,
} from "@/lib/constants";
import { DEFAULT_PROVIDER } from "@/lib/provider";
import { ModelInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import Cookies from "js-cookie";
import {
  ArrowUp,
  Coins,
  Image as ImageIcon,
  Loader2,
  LogOut,
  LucideArrowRight,
  LucideMenu,
  Sparkle,
  User,
  X,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ModelSelector } from "./components/chat/ModelSelector";
import { UpgradeDialog } from "./components/UpgradeDialog";
import { BuyCreditsDialog } from "./components/BuyCreditsDialog";
import Navbar from "@/components/NavBar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function Chat() {
  const { data: session, status } = useSession();
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [modelList, setModelList] = useState<ModelInfo[]>(
    DEFAULT_PROVIDER.staticModels
  );
  const [showingError, setShowingError] = useState(false);
  const { uploadImage, isUploading, uploadError, clearError } =
    useImageUpload();
  const [isModelLoading, setIsModelLoading] = useState<string | undefined>(
    "all"
  );
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showBuyCreditsDialog, setShowBuyCreditsDialog] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const savedWebSearch = Cookies.get("webSearchEnabled");
      return savedWebSearch === "true";
    }
    return false;
  });

  const [model, setModel] = useState(() => {
    const savedModel = Cookies.get("selectedModel");
    return savedModel || DEFAULT_MODEL;
  });

  // Check for returnPrompt URL parameter and pre-fill prompt
  const [userPrompt, setUserPrompt] = useState("");
  const { enhancePrompt, enhancingPrompt } = usePromptEnhancer();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isStarterLoading, setIsStarterLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const returnPrompt = urlParams.get("returnPrompt");
      if (returnPrompt && !userPrompt) {
        setUserPrompt(decodeURIComponent(returnPrompt));
        const url = new URL(window.location.href);
        url.searchParams.delete("returnPrompt");
        window.history.replaceState({}, document.title, url.pathname);
      }
    }
  }, [status, userPrompt]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsModelLoading("all");
      fetch("/api/models")
        .then((response) => response.json())
        .then((data) => {
          const typedData = data as { modelList: ModelInfo[] };
          setModelList(typedData.modelList);
        })
        .catch((error) => {
          console.error("Error fetching model list:", error);
        })
        .finally(() => {
          setIsModelLoading(undefined);
        });
    }
  }, []);

  useEffect(() => {
    async function fetchCredits() {
      if (session?.user?.email) {
        setLoadingCredits(true);
        const res = await fetch("/api/user/credits");
        if (res.ok) {
          const data = await res.json();
          setCreditBalance(data.credits);
        }
        setLoadingCredits(false);
      }
    }
    fetchCredits();
  }, [session?.user?.email]);

  const handleBuyCredits = () => {
    setShowBuyCreditsDialog(true);
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedPrompt = userPrompt.trim();
    if (!trimmedPrompt) return;

    // Check if user is authenticated before checking API key
    if (status !== "authenticated" || !session) {
      // Redirect to login with the prompt as a parameter
      const encodedPrompt = encodeURIComponent(trimmedPrompt);
      router.push(`/login?returnPrompt=${encodedPrompt}`);
      return;
    }

    setIsStarterLoading(true);

    try {
      let messageContent:
        | string
        | Array<{
            type: "text" | "image_url";
            text?: string;
            image_url?: { url: string };
          }>;

      if (uploadedImages.length > 0) {
        messageContent = [
          {
            type: "text",
            text: trimmedPrompt,
          },
          ...uploadedImages.map((image) => ({
            type: "image_url" as const,
            image_url: {
              url: image.signUrl,
            },
          })),
        ];
      } else {
        messageContent = trimmedPrompt;
      }

      // Create a new conversation in the database
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:
            trimmedPrompt.substring(0, 50) +
            (trimmedPrompt.length > 50 ? "..." : ""),
          initialMessage: messageContent,
          templateName: DEFAULT_TEMPLATE.name,
          sendFirst: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.requiresUpgrade) {
          setShowUpgradeDialog(true);
          setIsStarterLoading(false);
          return;
        }
        console.error(
          "Failed to start chat:",
          errorData.error || "Unknown error"
        );
        setIsStarterLoading(false);
        return;
      }

      const { conversation } = await response.json();
      if (!conversation || !conversation.id) {
        console.error("API did not return a valid conversation object.");
        setIsStarterLoading(false);
        return;
      }

      // Clean URL - only include conversation ID
      router.push(`/chat/${conversation.id}`);
    } catch (error) {
      console.error("Error initiating chat:", error);
    } finally {
      setIsStarterLoading(false);
      setUserPrompt("");
      setUploadedImages([]);
    }
  };

  const examplePrompts = [
    "A todo app with React and TypeScript",
    "E-commerce dashboard with Next.js",
    "Blog with Astro and Tailwind",
    "Chat app with React and Firebase",
    "Job board with Express and MongoDB",
  ];

  const handleLogout = async () => {
    await signOut({
      redirect: true,
      callbackUrl: "/login",
    });
  };

  const handleUploadImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    console.log("file", file);
    if (!file) return;

    clearError();
    const uploadedImage = await uploadImage(file);
    if (uploadedImage) {
      setUploadedImages((prev) => [...prev, uploadedImage]);
    }

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleTemplateClick = async (template: any) => {
    if (status !== "authenticated" || !session) {
      router.push("/login");
      return;
    }

    setIsStarterLoading(true);

    try {
      // Create a new conversation with the selected template
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `New ${template.label} Project`,
          templateName: template.name,
          sendFirst: false, // Don't auto-send for template starters
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.requiresUpgrade) {
          setShowUpgradeDialog(true);
          setIsStarterLoading(false);
          return;
        }
        console.error(
          "Failed to start template project:",
          errorData.error || "Unknown error"
        );
        setIsStarterLoading(false);
        return;
      }

      const { conversation } = await response.json();
      if (!conversation || !conversation.id) {
        console.error("API did not return a valid conversation object.");
        setIsStarterLoading(false);
        return;
      }

      // Navigate to the clean conversation URL
      router.push(`/chat/${conversation.id}`);
    } catch (error) {
      console.error("Error creating template project:", error);
    } finally {
      setIsStarterLoading(false);
    }
  };

  const toggleWebSearch = () => {
    const newWebSearchEnabled = !webSearchEnabled;
    setWebSearchEnabled(newWebSearchEnabled);
    Cookies.set("webSearchEnabled", String(newWebSearchEnabled), {
      expires: 365,
    });
  };

  return (
    <div className="bg-gradient-to-br from-blue-900 from-10% to-black to-90% min-h-screen  text-white overflow-y-auto">
      {/* Navbar */}
      {status === "unauthenticated" ? (
        <Navbar />
      ) : (
        <header className="flex justify-between items-center p-3">
          <h4 className="text-xl font-extrabold w-full max-w-36">Yep Dev</h4>
          <div className="md:hidden flex justify-end items-center gap-2">
            <div className="text-sm">
              Available Credits: {loadingCredits ? "..." : creditBalance ?? 0}
            </div>
            <SidebarMenu className="flex w-fit ">
              <SidebarMenuItem>
                <DropdownMenu
                  open={dropdownOpen}
                  onOpenChange={setDropdownOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="flex justify-center"
                    >
                      <LucideMenu />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-[--radix-dropdown-menu-trigger-width] min-w-56 bg-black rounded-lg border-none"
                    side="bottom"
                    align="end"
                    sideOffset={4}
                  >
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <User />
                      {session?.user?.email}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleBuyCredits}
                    >
                      <Sparkle />
                      Buy Credits
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        signOut({
                          callbackUrl: "/login",
                          redirect: true,
                        })
                      }
                    >
                      <LogOut />
                      Log out
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
          <div className="w-full justify-end items-center gap-4 hidden md:flex">
            <div className="text-sm">{session?.user?.email}</div>
            <div className="text-sm">
              Credit Balance: {loadingCredits ? "..." : creditBalance ?? 0}
            </div>
            <Button
              className="rounded-md bg-[#161618] hover:bg-[#232327] shadow-sm p-3"
              onClick={handleBuyCredits}
            >
              Buy Credits
            </Button>
            <Button
              className="rounded-md bg-[#161618] hover:bg-[#232327] shadow-sm p-3"
              onClick={handleLogout}
            >
              Sign Out
            </Button>
          </div>
        </header>
      )}

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-10">
        {/* Heading */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 lg:gap-4 flex-col  mt-8">
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl lg:text-5xl font-medium tracking-tight">
                Build any apps with Yep
              </h1>
              <Badge className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-0">
                Beta
              </Badge>
            </div>
            <p className="text-gray-400 text-center text-lg">
              Yep builds complete, cross-platform web apps using AI.
            </p>
          </div>
        </div>

        {/* Main prompt area */}
        <div className="w-full pt-4">
          <form
            onSubmit={handleSubmit}
            className="bg-transparent w-full flex flex-col gap-4"
          >
            <div className="bg-gradient-to-r rounded-md from-cyan-500 to-black p-[0.5px]">
              <div className="w-full">
                <ModelSelector
                  model={model}
                  setModel={setModel}
                  modelList={modelList}
                  apiKeys={{}}
                  modelLoading={isModelLoading}
                />
              </div>
            </div>
            <div className="border border-[#313133] rounded-md bg-[#161618] shadow-sm">
              {/* Image preview area */}
              {uploadedImages.length > 0 && (
                <div className="mb-3 p-3 bg-[#1a1a1c] rounded-lg border border-[#313133]">
                  <div className="flex flex-wrap gap-2">
                    {uploadedImages.map((image, index) => (
                      <div key={index} className="relative group">
                        <Image
                          src={image.url}
                          alt={image.filename || "Uploaded image"}
                          width={80}
                          height={80}
                          className="w-20 h-20 object-cover rounded border border-[#313133]"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b truncate">
                          {image.filename}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload error display */}
              {uploadError && (
                <div className="mb-3 p-2 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-sm">
                  {uploadError}
                </div>
              )}

              <div className="p-3 relative">
                <Textarea
                  ref={textareaRef}
                  placeholder="An app that helps me plan my day"
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  onPaste={async (event) => {
                    const items = event.clipboardData?.items;
                    if (!items) return;

                    for (const item of Array.from(items)) {
                      if (item.type.startsWith("image/")) {
                        event.preventDefault();
                        clearError();

                        const file = item.getAsFile();
                        if (file) {
                          const uploadedImage = await uploadImage(file);
                          if (uploadedImage) {
                            setUploadedImages((prev) => [
                              ...prev,
                              uploadedImage,
                            ]);
                          }
                        }
                        break;
                      }
                    }
                  }}
                  className="min-h-[56px] max-h-[250px] resize-none border-0 p-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-gray-500 text-sm pr-12 overflow-y-auto"
                  translate="no"
                  style={{
                    transition: "height 0.1s ease",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  disabled={creditBalance !== null && creditBalance <= 0}
                />
                {(userPrompt.length > 0 || isStarterLoading) && (
                  <div className="absolute top-3 right-3">
                    <Button
                      type="submit"
                      size="icon"
                      className="h-10 w-10 rounded-full bg-blue-500 hover:bg-blue-600"
                      disabled={
                        isStarterLoading ||
                        enhancingPrompt ||
                        !userPrompt.trim() ||
                        (creditBalance !== null && creditBalance <= 0)
                      }
                    >
                      {isStarterLoading ? (
                        <Icons.spinner className="w-5 h-5 text-[#101012] animate-spin" />
                      ) : (
                        <ArrowUp className="w-5 h-5 text-[#101012]" />
                      )}
                    </Button>
                  </div>
                )}
                {creditBalance !== null && creditBalance <= 0 && (
                  <div className=" text-red-500 my-1 text-sm flex items-center">
                    You&apos;ve run out of credits. Refill now to continue.
                  </div>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex justify-start p-3 mt-4">
                <div className="flex items-center gap-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-[#969798] hover:text-[#f3f6f6] hover:bg-[#212122]"
                    disabled={showingError || isUploading}
                    onClick={handleUploadImage}
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                  </Button>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-300 transition-colors cursor-pointer disabled:opacity-50"
                    onClick={() =>
                      enhancePrompt(userPrompt, setUserPrompt, model)
                    }
                    disabled={enhancingPrompt || userPrompt.length === 0}
                  >
                    <Icons.sparkles
                      className={`w-4 h-4 ${
                        enhancingPrompt ? "animate-pulse" : ""
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "transition-colors cursor-pointer disabled:opacity-50",
                      webSearchEnabled
                        ? "text-blue-400 hover:text-blue-300"
                        : "text-gray-400 hover:text-gray-300"
                    )}
                    onClick={toggleWebSearch}
                    title={
                      webSearchEnabled
                        ? "Disable web search"
                        : "Enable web search"
                    }
                  >
                    <div className="flex gap-1 items-center">
                      <Icons.search
                        className={cn(
                          "w-4 h-4",
                          webSearchEnabled && "text-blue-400"
                        )}
                      />
                      <p className={webSearchEnabled ? "text-blue-400" : ""}>
                        Search
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="space-y-3 pt-10">
          <div className="text-sm text-gray-400">Try building</div>
          <div className="flex flex-wrap gap-2 lg:gap-3 flex-row items-center justify-center">
            {examplePrompts.map((example, index) => (
              <button
                key={index}
                className="px-3 py-1.5 flex items-center gap-1 text-sm bg-[#161618] border border-[#313133] rounded-full hover:bg-[#1e1e20] transition-colors disabled:opacity-50"
                onClick={() => {
                  if (status !== "authenticated" || !session) {
                    const encodedPrompt = encodeURIComponent(example);
                    router.push(`/login?returnPrompt=${encodedPrompt}`);
                  } else {
                    setUserPrompt(example);
                  }
                }}
              >
                {example} <LucideArrowRight size={15} />
              </button>
            ))}
          </div>
        </div>

        {/* Start coding section */}
        <div className="space-y-6 pt-12">
          <h2 className="text-sm font-medium text-gray-200">
            Or start a blank app with your favorite stack
          </h2>

          <div className="flex items-center space-x-2 overflow-x-auto pb-2 justify-center">
            <div className="flex items-center gap-3">
              {STARTER_TEMPLATES.map((template) => (
                <button
                  key={template.name}
                  onClick={() => handleTemplateClick(template)}
                  className={`flex flex-col items-center gap-2 group hover:bg-gray-900 rounded-xl p-4 transition-colors justify-center`}
                  aria-label={template.label}
                >
                  <div className="w-7 h-7 flex items-center justify-center opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-opacity">
                    {Icons[template.icon]({
                      className: "w-7 h-7",
                      style: { maskType: "alpha" },
                    })}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
      />
      <BuyCreditsDialog
        open={showBuyCreditsDialog}
        onOpenChange={setShowBuyCreditsDialog}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <AuthenticatedLayout>
      <Chat />
    </AuthenticatedLayout>
  );
}
