"use client";

import { useSession } from "./cabinet";
import { Dashboard } from "./dashboard";

export default function Home() {
  const session = useSession();
  return session && <Dashboard session={session} />;
}
