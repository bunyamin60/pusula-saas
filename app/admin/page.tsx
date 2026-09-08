import { redirect } from "next/navigation";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

export default function AdminRedirectPage() {
  redirect(`/${DEFAULT_TENANT_ID}/admin`);
}
