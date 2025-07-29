"use client";

import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Page({
  searchParams,
}: {
  searchParams: { canceled: boolean; success: boolean };
}) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center p-4 md:p-8 bg-white ">
      {searchParams.success ? (
        <div className="mx-auto w-full flex flex-col gap-3 justify-center items-center max-w-md space-y-6 rounded-2xl border border-gray-200 bg-white p-6 ">
          <div className="flex flex-col gap-2.5 items-center justify-center">
            <div className="p-2 bg-green-400 w-fit h-fit rounded-full">
              <Check size={40} />
            </div>
            <span className="text-xl font-bold">Transaction Successful!</span>
          </div>
          <span className="text-center">
            Thank you for your paymet! Your payment is being processed.
          </span>
          <Button
            onClick={() => router.push("/")}
            className="bg-blue-500 hover:bg-blue-400"
          >
            Return
          </Button>
        </div>
      ) : (
        <div className="mx-auto w-full flex flex-col gap-3 justify-center items-center max-w-md space-y-6 rounded-2xl border border-gray-200 bg-white p-6 ">
          <div className="flex flex-col gap-2.5 items-center justify-center">
            <div className="p-2 bg-red-400 w-fit h-fit rounded-full">
              <X size={40} />
            </div>
            <span className="text-xl font-bold">Transaction Cancelled!</span>
          </div>
          <span className="text-center">
            Your payment has been successfully cancelled.
          </span>
          <Button
            onClick={() => router.push("/")}
            className="bg-blue-500 hover:bg-blue-400"
          >
            Return
          </Button>
        </div>
      )}
    </div>
  );
}
