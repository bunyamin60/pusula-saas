import { StatusScreen } from "@/components/StatusScreen";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

export default function NotFound() {
  return <StatusScreen variant="notFound" href={`/${DEFAULT_TENANT_ID}`} />;
}
