import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SettingsClient from "@/components/SettingsClient";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <SettingsClient name={user.name} email={user.email} role={user.role} verified={!!user.creatorProfile?.verified} twoFactorEnabled={!!user.twoFactorEnabled} emailVerified={!!user.emailVerified} />;
}
