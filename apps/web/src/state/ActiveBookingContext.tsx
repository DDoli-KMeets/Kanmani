import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * Lets whichever screen is currently showing a specific meetup (the meetup
 * detail page) tell the always-visible SOS button which booking to attach
 * the alert to, so venue staff know exactly where to respond — without
 * every other screen needing to know about it. A page sets this on mount
 * and clears it on unmount via useActiveBooking below.
 */
interface ActiveBookingContextValue {
  activeBookingId: string | undefined;
  setActiveBookingId: (id: string | undefined) => void;
}

const ActiveBookingContext = createContext<ActiveBookingContextValue | undefined>(undefined);

export function ActiveBookingProvider({ children }: { children: ReactNode }) {
  const [activeBookingId, setActiveBookingId] = useState<string | undefined>(undefined);
  const value = useMemo(() => ({ activeBookingId, setActiveBookingId }), [activeBookingId]);
  return <ActiveBookingContext.Provider value={value}>{children}</ActiveBookingContext.Provider>;
}

export function useActiveBookingContext(): ActiveBookingContextValue {
  const ctx = useContext(ActiveBookingContext);
  if (!ctx) throw new Error("useActiveBookingContext must be used inside ActiveBookingProvider");
  return ctx;
}

/** Call from a screen that's showing one specific booking. */
export function useSetActiveBooking(bookingId: string | undefined) {
  const { setActiveBookingId } = useActiveBookingContext();
  useEffect(() => {
    setActiveBookingId(bookingId);
    return () => setActiveBookingId(undefined);
  }, [bookingId, setActiveBookingId]);
}
