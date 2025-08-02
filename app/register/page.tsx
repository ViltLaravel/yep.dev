import { RegisterForm } from "@/components/auth/RegisterForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register",
  description: "Create a new account",
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 md:p-8 bg-[#FAFAFA] ">
      <div className="mx-auto w-full max-w-md shadow-md space-y-6 rounded-2xl bg-white p-6 ">
        <RegisterForm />
      </div>
    </div>
  );
}
