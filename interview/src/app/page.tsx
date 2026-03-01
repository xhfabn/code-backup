import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function AppPage() {
  const user = await prisma.user.findFirst();
  
  if (user) {
  redirect('/home');
  } else {
    redirect('/onboarding');
  }
}
