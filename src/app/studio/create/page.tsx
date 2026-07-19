import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import CreateWizard from "@/components/CreateWizard";
export const dynamic = "force-dynamic";
export default async function CreatePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <CreateWizard />;
}
