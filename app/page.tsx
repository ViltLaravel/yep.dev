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
  Image as ImageIcon,
  Link,
  Loader2,
  LogOut,
  LucideAppWindow,
  LucideArrowRight,
  LucideBox,
  LucideBriefcase,
  LucideCircleDollarSign,
  LucideClipboard,
  LucideCoins,
  LucideLogOut,
  LucideMenu,
  LucideMessageCircle,
  LucideShoppingCart,
  Sparkle,
  User,
  X,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ModelSelector } from "./components/chat/ModelSelector";

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
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AppDrawer from "./components/sidebar/app-drawer";

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

  const handleModelChange = (newModel: string) => {
    const baseModel = newModel.replace(":online", "");
    setModel(baseModel);
    Cookies.set("selectedModel", baseModel, { expires: 30 });
  };

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
    {
      name: "A todo app with React and TypeScript",
      icon: <LucideClipboard size={15} />,
    },
    {
      name: "E-commerce dashboard with Next.js",
      icon: <LucideShoppingCart size={15} />,
    },
    {
      name: "Blog with Astro and Tailwind",
      icon: <LucideBox size={15} />,
    },
    {
      name: "Chat app with React and Firebase",
      icon: <LucideMessageCircle size={15} />,
    },
    {
      name: "Job board with Express and MongoDB",
      icon: <LucideBriefcase size={15} />,
    },
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
    <div className="bg-white text-gray-900 w-full h-full overflow-y-auto">
      {status === "unauthenticated" ? (
        <Navbar />
      ) : (
        <header className="flex w-full h-16 top-0 sticky justify-between bg-white items-center p-3">
          <div className="w-full flex gap-2 justify-start items-center md:hidden">
            <AppDrawer />
            <p className="text-gray-200">/</p>
            <span className="text-xl font-extrabold">Yep.dev</span>
          </div>
          <span className="text-xl hidden md:flex font-extrabold">Yep.dev</span>
          <div className="flex justify-end items-center gap-2">
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
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={session.user.image ?? "/yep-assets/profile.jpg"}
                          alt="profile-img"
                        />
                        <AvatarFallback>YD</AvatarFallback>
                      </Avatar>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-[--radix-dropdown-menu-trigger-width] p-0 min-w-56 bg-white rounded-lg border border-gray-200"
                    side="bottom"
                    align="end"
                    sideOffset={4}
                  >
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="flex flex-col gap-1 justify-start items-start">
                      <h4>{session.user.name}</h4>
                      <p className="text-xs text-gray-400">
                        {session?.user?.email}
                      </p>
                    </DropdownMenuItem>
                    <Separator className="bg-gray-200 w-full" />
                    <DropdownMenuItem className="flex flex-col gap-2 justify-start items-start">
                      <h4 className="text-gray-400 text-xs font-medium">
                        Credit Balance
                      </h4>
                      <div className="flex w-full justify-between items-center text-xs">
                        <span>Available Credits</span>
                        <p className="text-gray-400">
                          {loadingCredits
                            ? "..."
                            : creditBalance
                            ? creditBalance.toFixed(2)
                            : 0}
                        </p>
                      </div>
                      <Button className="w-full" onClick={handleBuyCredits}>
                        <LucideCircleDollarSign />
                        Buy More Credits
                      </Button>
                    </DropdownMenuItem>
                    <Separator className="w-full bg-gray-200" />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() =>
                        signOut({
                          callbackUrl: "/login",
                          redirect: true,
                        })
                      }
                    >
                      <LogOut />
                      Sign Out
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </header>
      )}

      <div className="w-full h-full px-2 md:px-6 pb-6 overflow-y-auto">
        <div className="w-full h-full bg-[#FAFAFA] rounded-3xl">
          <div className="max-w-4xl mx-auto h-full p-2 md:px-6 md:py-8 flex flex-col gap-10">
            {/* Heading */}
            <div className="h-full w-full">
              <div className="flex items-center gap-2 lg:gap-4 flex-col  mt-8">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl lg:text-5xl font-medium tracking-tight">
                    Build any apps with Yep
                  </h1>
                  <Badge className="bg-blue-100 text-blue-600 border-0 ">
                    Beta
                  </Badge>
                </div>
                <p className="text-gray-500 text-center text-sm md:text-lg">
                  Yep builds complete, cross-platform web apps using AI.
                </p>
              </div>
            </div>

            {/* Main prompt area */}
            <div className="w-full flex flex-col gap-3 h-full">
              <div className="w-full text-sm md:hidden">
                <ModelSelector
                  model={model}
                  isMain={true}
                  setModel={handleModelChange}
                  modelList={modelList}
                  apiKey={process.env.OPENROUTER_API_KEY}
                  modelLoading={isModelLoading}
                />
              </div>
              <form
                onSubmit={handleSubmit}
                className="bg-transparent w-full flex flex-col gap-4"
              >
                <div className="border border-gray-200 rounded-3xl p-4 flex flex-col gap-2 shadow-sm bg-white">
                  {/* Image preview area */}
                  {uploadedImages.length > 0 && (
                    <div className="mb-3 p-3 bg-transparent border-none">
                      <div className="flex flex-wrap gap-2">
                        {uploadedImages.map((image, index) => (
                          <div key={index} className="relative group">
                            <Image
                              src={image.url}
                              alt={image.filename || "Uploaded image"}
                              width={80}
                              height={80}
                              className="w-20 h-20 object-cover rounded border border-gray-200"
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
                    <div className="mb-3 p-2 bg-red-100 border border-red-200 rounded text-red-600 text-sm">
                      {uploadError}
                    </div>
                  )}

                  <div className="w-full h-full relative">
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
                      className="min-h-[56px] max-h-[10px] resize-none border-0 p-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-gray-500 text-sm pr-12 overflow-y-auto "
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
                      <Button
                        type="submit"
                        size="icon"
                        className="w-fit absolute hidden lg:flex top-0 right-0 rounded-full px-4 hover:bg-[#27272b] border-none bg-[#101012] text-white"
                        disabled={
                          isStarterLoading ||
                          enhancingPrompt ||
                          !userPrompt.trim() ||
                          (creditBalance !== null && creditBalance <= 0)
                        }
                      >
                        {isStarterLoading ? (
                          <Icons.spinner
                            size={15}
                            className=" text-white animate-spin"
                          />
                        ) : (
                          <>
                            <ArrowUp size={15} className="text-white" /> Send
                          </>
                        )}
                      </Button>
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

                  <div className="flex justify-between w-full">
                    <div className="hidden md:flex justify-start flex-row items-center w-full">
                      <div className="w-fit text-sm">
                        <ModelSelector
                          model={model}
                          isMain={true}
                          setModel={handleModelChange}
                          modelList={modelList}
                          apiKey={process.env.OPENROUTER_API_KEY}
                          modelLoading={isModelLoading}
                        />
                      </div>
                    </div>
                    <div className="w-full hidden lg:flex justify-end items-center gap-3">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-fit border border-gray-200 shadow-sm rounded-full px-3 text-black font-medium hover:text-gray-600 bg-white hover:bg-gray-100 "
                        disabled={showingError || isUploading}
                        onClick={handleUploadImage}
                      >
                        {isUploading ? (
                          <Loader2 size={15} className=" animate-spin" />
                        ) : (
                          <>
                            <Link size={15} className="" /> Attach
                          </>
                        )}
                      </Button>
                      <button
                        type="button"
                        className={cn(
                          "transition-colors rounded-full shadow-sm hover:bg-gray-100 border border-gray-200 px-3 h-full cursor-pointer disabled:opacity-50",
                          webSearchEnabled
                            ? "text-blue-600 hover:text-blue-500"
                            : "text-black hover:text-blue-500"
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
                          <p
                            className={webSearchEnabled ? "text-blue-600" : ""}
                          >
                            Search
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="text-black flex shadow-sm rounded-full border border-gray-200 hover:bg-gray-100 h-full px-3 justify-start items-center gap-1 hover:text-gray-600 transition-colors cursor-pointer"
                        onClick={() =>
                          enhancePrompt(userPrompt, setUserPrompt, model)
                        }
                        disabled={enhancingPrompt || userPrompt.length === 0}
                      >
                        <Icons.sparkles
                          size={15}
                          className={`${
                            enhancingPrompt ? "animate-pulse" : ""
                          }`}
                        />
                        Enhance
                      </button>
                    </div>
                    <div className="w-full flex lg:hidden justify-end items-center gap-2 lg:gap-3">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-fit text-black p-1 h-fit font-medium hover:text-gray-600"
                        disabled={showingError || isUploading}
                        onClick={handleUploadImage}
                      >
                        {isUploading ? (
                          <Loader2 size={15} className=" animate-spin" />
                        ) : (
                          <>
                            <Link size={15} className="" />
                          </>
                        )}
                      </Button>
                      <button
                        type="button"
                        className={cn(
                          "transition-colors h-full cursor-pointer disabled:opacity-50",
                          webSearchEnabled
                            ? "text-blue-600 hover:text-blue-500"
                            : "text-black hover:text-blue-500"
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
                          <p
                            className={webSearchEnabled ? "text-blue-600" : ""}
                          >
                            Search
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="text-black flex w-fit h-fit p-1 hover:text-gray-600 transition-colors cursor-pointer"
                        onClick={() =>
                          enhancePrompt(userPrompt, setUserPrompt, model)
                        }
                        disabled={enhancingPrompt || userPrompt.length === 0}
                      >
                        <Icons.sparkles
                          size={15}
                          className={`${
                            enhancingPrompt ? "animate-pulse text-blue-600" : ""
                          }`}
                        />
                      </button>
                      <Button
                        type="submit"
                        size="icon"
                        className={`w-fit h-fit p-1 border-none rounded-lg bg-gray-200 text-white ${
                          userPrompt.length > 0 && "bg-black"
                        }`}
                        disabled={
                          isStarterLoading ||
                          enhancingPrompt ||
                          !userPrompt.trim() ||
                          (creditBalance !== null && creditBalance <= 0)
                        }
                      >
                        {isStarterLoading ? (
                          <Icons.spinner
                            size={15}
                            className=" text-white animate-spin"
                          />
                        ) : (
                          <ArrowUp size={15} className="text-white" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
              <div className="flex flex-wrap lg:hidden gap-3 flex-row items-center justify-center">
                {examplePrompts.map((example, index) => (
                  <button
                    key={index}
                    className="px-3 py-1.5 flex items-center gap-2 text-sm bg-white shadow-sm rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 "
                    onClick={() => {
                      if (status !== "authenticated" || !session) {
                        const encodedPrompt = encodeURIComponent(example.name);
                        router.push(`/login?returnPrompt=${encodedPrompt}`);
                      } else {
                        setUserPrompt(example.name);
                      }
                    }}
                  >
                    {example.icon} {example.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full h-full space-y-2 hidden lg:flex flex-col gap-2">
              <div className="text-sm text-gray-400">Try building</div>
              <div className="flex flex-wrap gap-3 flex-row items-center justify-center">
                {examplePrompts.map((example, index) => (
                  <button
                    key={index}
                    className="px-3 py-1.5 flex items-center gap-2 text-sm bg-white shadow-sm rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 "
                    onClick={() => {
                      if (status !== "authenticated" || !session) {
                        const encodedPrompt = encodeURIComponent(example.name);
                        router.push(`/login?returnPrompt=${encodedPrompt}`);
                      } else {
                        setUserPrompt(example.name);
                      }
                    }}
                  >
                    {example.icon} {example.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Start coding section */}
            <div className="h-full w-full space-y-2">
              <h2 className="text-sm text-gray-400">
                Or start a blank app with your favorite stack
              </h2>

              <div className="flex items-center justify-center flex-wrap gap-3">
                {STARTER_TEMPLATES.map((template) => (
                  <button
                    key={template.name}
                    onClick={() => handleTemplateClick(template)}
                    className={`flex flex-col items-center gap-2 shadow-sm border-none bg-white group hover:bg-gray-100 rounded-2xl p-4 transition-colors justify-center `}
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
      </div>

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
