import { redirect } from "next/navigation";

export const metadata = {
  title: "설정 · MINION",
};

export default function SettingsPage() {
  redirect("/me#profile");
}
