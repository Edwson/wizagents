import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import VerifyForm from "@/components/VerifyForm";

export const dynamic = "force-dynamic";

export default async function VerificationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const p = user.creatorProfile;
  // The form refetches /api/kyc on mount; these are the first-paint fallback.
  return (
    <VerifyForm
      verified={!!p?.verified}
      identityVerified={!!p?.identityVerified}
      kycStatus={p?.kycStatus || "none"}
      status={p?.verificationStatus || "none"}
    />
  );
}
