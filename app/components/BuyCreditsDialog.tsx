"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Coins } from "lucide-react";
import { useState } from "react";

interface BuyCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuyCreditsDialog({ open, onOpenChange }: BuyCreditsDialogProps) {
  const [credits, setCredits] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleBuyCredits = async () => {
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
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
    } finally {
      setIsLoading(false);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setCredits("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#161618] border-[#313133] text-white">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-gradient-to-r from-yellow-500 to-orange-600 flex items-center justify-center">
            <Coins className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-xl font-semibold">
            Buy Credits
          </DialogTitle>
          <DialogDescription className="text-gray-400 mt-2">
            Enter the number of credits you want to purchase to continue using our services.
          </DialogDescription>
        </DialogHeader>

        <div className="my-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="credits" className="block text-sm font-medium text-gray-300 mb-2">
                Number of Credits
              </label>
              <Input
                id="credits"
                type="number"
                min="1"
                placeholder="Enter number of credits"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                className="bg-[#1a1a1c] border-[#313133] text-white placeholder:text-gray-500 focus:border-blue-500"
              />
            </div>
            <div className="text-xs text-gray-500">
              Credits are used for AI model interactions and other premium features.
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-[#313133] bg-transparent hover:bg-[#1a1a1c] text-gray-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleBuyCredits}
            disabled={!credits || Number(credits) <= 0 || isLoading}
            className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white disabled:opacity-50"
          >
            {isLoading ? "Processing..." : "Buy Credits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 