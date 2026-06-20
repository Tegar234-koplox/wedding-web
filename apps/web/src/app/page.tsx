import { redirect } from "next/navigation";

import { defaultLocale } from "@/lib/locales";

export default function IndexPage(): never {
  redirect(`/${defaultLocale}`);
}
