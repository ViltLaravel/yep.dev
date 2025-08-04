import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { LucideLogIn } from "lucide-react";

export default function Navbar() {
  const router = useRouter();
  return (
    <header className="w-full sticky top-0 h-16 justify-end flex bg-white items-center px-8 py-4">
      <div className="flex w-full justify-between items-center gap-4">
        <h4 className="text-xl font-extrabold w-full">Yep.dev</h4>
        <div className="w-full flex justify-end items-center">
          <Button
            className="rounded-full text-sm bg-white hover:bg-gray-100 border border-gray-200 text-gray-900  flex justify-center items-center"
            onClick={() => router.push("/login")}
          >
            Sign In <LucideLogIn size={15} />
          </Button>
        </div>
      </div>
    </header>
  );
}
