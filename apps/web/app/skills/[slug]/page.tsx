import { isJobTag } from "@gaming/shared";
import { notFound, redirect } from "next/navigation";

type SkillParams = Promise<{ slug: string }>;

export default async function SkillPage({ params }: { params: SkillParams }) {
  const { slug } = await params;
  if (isJobTag(slug)) {
    redirect(`/${slug}-jobs`);
  }
  notFound();
}
