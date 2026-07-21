import { redirect } from "next/navigation";

export default async function AdminFanHeadersPage() {
  redirect("/admin/fan-sites");
}
