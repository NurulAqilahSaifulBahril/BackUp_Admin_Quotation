import { Inter } from "next/font/google";
import "../globals.css";
import { Sidebar } from "@/components/Sidebar";
import { getUser } from "@/lib/auth";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  return (
    <div className={`${inter.variable} flex min-h-screen bg-secondary-50`}>
      <Sidebar user={user} />
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
