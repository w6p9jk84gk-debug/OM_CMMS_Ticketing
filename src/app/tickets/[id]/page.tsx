import { CmmsApp } from "@/components/cmms-app";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CmmsApp view="detail" ticketId={id} />;
}
