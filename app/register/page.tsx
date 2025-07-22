import { RegisterForm } from "@/components/auth/RegisterForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register",
  description: "Create a new account",
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 md:p-8 bg-[#101012] bg-gradient-to-t relative from-purple-500/20 to-black">
      <div className="absolute inset-0 backdrop-blur-md bg-black/20" />
      <div className="mx-auto absolute z-10 w-full max-w-md space-y-6 rounded-xl border-none bg-[#161618] p-6 shadow-lg dark:border-gray-800 dark:bg-gray-950">
        <RegisterForm />
      </div>
    </div>
  );
}
