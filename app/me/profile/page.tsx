import { redirect } from "next/navigation";

export const metadata = {
  title: "프로필 관리 · MINION",
};

export default function ProfilePage() {
  redirect("/me#profile");
}
