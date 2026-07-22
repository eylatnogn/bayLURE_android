// bayLURE Pro state + free-tier limits.
//
// BILLING IS TEMPORARILY REMOVED for the first store release: RevenueCat/Play
// can't be linked until the app is published, and shipping the BILLING
// permission with no products invites review questions. Until it returns,
// Pro can only be unlocked with a redeem code (see redeem.ts), subscribing is
// disabled ("coming soon"), and free-tier limits stay dormant in production —
// never block a save the user has no way to pay for. Dev builds enforce the
// limits so the paywall stays testable.
//
// The context API below is billing-shaped on purpose. To restore billing:
// `npm install react-native-purchases`, re-add the RevenueCat configure/
// purchase/restore internals (git history of this file, 2026-07-09), and put
// EXPO_PUBLIC_REVENUECAT_ANDROID_KEY back into eas.json's production env.
//
// PRICING (2026-07-20): $1.99/month with the first 2 weeks free. The price
// and trial live in Google Play Console, not here — when creating the
// subscription product (suggested id baylure_pro_monthly), set the base plan
// to $1.99/month and add a 14-day free-trial offer (new subscribers only;
// Play charges nothing until the trial ends and cancelling inside the trial
// costs nothing). The strings below are display copy and must match it.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { loadRedeemed, redeemCode } from '@/purchases/redeem';

/** What free users can save before the paywall (only enforced when billing exists). */
export const FREE_LIMITS = {
  spots: 1,
  presets: 1,
  catches: 3,
  /** Forecast days free users can open: today + tomorrow. Beyond needs Pro. */
  forecastDays: 2,
} as const;

interface ProContextValue {
  /** True when Pro is unlocked (currently: redeem code only). */
  isPro: boolean;
  /** True when billing is wired up and the subscribe button can work. */
  canSubscribe: boolean;
  /** Whether free-tier limits are enforced (dev-only while billing is out). */
  limitsActive: boolean;
  /** Display price for the paywall. */
  priceString: string;
  /** In-flight purchase/restore, for button spinners. */
  busy: boolean;
  paywallVisible: boolean;
  showPaywall: () => void;
  hidePaywall: () => void;
  /** No-op while billing is removed. */
  subscribe: () => Promise<void>;
  /** No-op while billing is removed (button is hidden when !canSubscribe). */
  restore: () => Promise<'restored' | 'none' | 'error'>;
  /** Unlocks Pro with a redeem/promo code. True if the code was valid. */
  redeem: (code: string) => Promise<boolean>;
}

const ProContext = createContext<ProContextValue>({
  isPro: false,
  canSubscribe: false,
  limitsActive: false,
  priceString: '$1.99',
  busy: false,
  paywallVisible: false,
  showPaywall: () => {},
  hidePaywall: () => {},
  subscribe: async () => {},
  restore: async () => 'error',
  redeem: async () => false,
});

export function usePro(): ProContextValue {
  return useContext(ProContext);
}

export function ProProvider({ children }: { children: ReactNode }) {
  const [redeemed, setRedeemed] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  useEffect(() => {
    void loadRedeemed().then(setRedeemed).catch(() => {});
  }, []);

  const redeem = useCallback(async (code: string): Promise<boolean> => {
    const ok = await redeemCode(code);
    if (ok) {
      setRedeemed(true);
      setPaywallVisible(false);
    }
    return ok;
  }, []);

  return (
    <ProContext.Provider
      value={{
        isPro: redeemed,
        canSubscribe: false,
        limitsActive: __DEV__,
        priceString: '$1.99',
        busy: false,
        paywallVisible,
        showPaywall: () => setPaywallVisible(true),
        hidePaywall: () => setPaywallVisible(false),
        subscribe: async () => {},
        restore: async () => 'error',
        redeem,
      }}
    >
      {children}
    </ProContext.Provider>
  );
}
