import type { Metadata } from "next";
import "@/styles/globals.css";

import { prisma } from "@/lib/db";
import DashboardStateInitializer from "@/components/layout/DashboardStateInitializer";

export const metadata: Metadata = {
  title: "面试通",
  description:
    "基于记忆曲线的计算机八股文复习系统，助你高效备战技术面试",
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await prisma.user.findFirst();

  return (
    <html lang="zh-CN">
      <body className="antialiased bg-gray-50 text-gray-900 selection:bg-[#3b82f6] selection:text-white">
        {user && <DashboardStateInitializer user={user} />}
            {children}
      </body>
    </html>
  );
}
