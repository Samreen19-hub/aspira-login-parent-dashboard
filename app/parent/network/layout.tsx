import type { ReactNode } from "react"
import { NetworkStoreProvider } from "@/components/parent/network-store"

// Wrapping both /parent/network and /parent/network/requests in one provider keeps the relationship
// state live and synchronized as the user navigates between the list and the requests view — the
// layout persists across child navigations, so accepting a request updates both instantly.
export default function NetworkLayout({ children }: { children: ReactNode }) {
  return <NetworkStoreProvider>{children}</NetworkStoreProvider>
}
