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

export function BuyCreditsDialog({
  open,
  onOpenChange,
}: BuyCreditsDialogProps) {
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
      <DialogContent className="sm:max-w-md bg-white border border-gray-200 text-gray-600  rounded">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
            <Coins className="h-6 w-6 text-yellow-500" />
          </div>
          <DialogTitle className="text-xl font-semibold text-gray-600 ">
            Buy Credits
          </DialogTitle>
          <DialogDescription className="text-gray-500 mt-2 ">
            Enter the number of credits you want to purchase to continue using
            our services.
          </DialogDescription>
        </DialogHeader>

        <div className="my-6">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="credits"
                className="block text-sm font-medium text-gray-600 mb-2 "
              >
                Number of Credits
              </label>
              <Input
                id="credits"
                type="number"
                min="1"
                placeholder="Enter number of credits"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                className="bg-white border border-gray-200 text-gray-600 placeholder:text-gray-400 focus:border-gray-200 "
              />
            </div>
            <div className="text-xs text-gray-500 ">
              Credits are used for AI model interactions and other premium
              features.
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 ">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 "
          >
            Cancel
          </Button>
          <Button
            onClick={handleBuyCredits}
            disabled={!credits || Number(credits) <= 0 || isLoading}
            className="rounded-md bg-white hover:bg-gray-100 border border-gray-200 p-3 text-gray-600 "
          >
            {isLoading ? "Processing..." : "Buy Credits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
