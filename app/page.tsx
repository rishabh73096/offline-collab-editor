import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LandingPage } from "@/components/marketing/LandingPage";

export default async function Home() {
  const session = await getSession();
  if (session?.user) {
    redirect("/documents");
  }
  return <LandingPage />;
}
