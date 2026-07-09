import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Create your account</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-zinc-950 underline dark:text-zinc-50">
            Sign in
          </Link>
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
