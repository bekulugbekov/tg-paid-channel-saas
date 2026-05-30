// In-memory FSM state for multi-step bot conversations (plan creation & merchant setup).
// State is intentionally ephemeral — lost on restart, user simply starts over.

export type PlanStep = "name" | "price" | "duration" | "description" | "confirm";

export interface PlanState {
  type: "plan";
  step: PlanStep;
  channelId: string;
  channelTitle: string;
  name?: string;
  priceUzs?: number;
  durationDays?: number;
  description?: string | null;
}

export type MerchantProvider = "payme" | "click" | "both";
export type MerchantStep =
  | "provider"
  | "payme_mid" | "payme_key"
  | "click_sid" | "click_mid" | "click_uid" | "click_secret"
  | "done";

export interface MerchantState {
  type: "merchant";
  step: MerchantStep;
  provider?: MerchantProvider;
  paymeMerchantId?: string;
  paymeKey?: string;
  clickServiceId?: string;
  clickMerchantId?: string;
  clickUserId?: string;
  clickSecret?: string;
}

export type FsmState = PlanState | MerchantState;

const store = new Map<number, FsmState>();

export const fsm = {
  get:  (userId: number): FsmState | undefined => store.get(userId),
  set:  (userId: number, state: FsmState): void  => { store.set(userId, state); },
  del:  (userId: number): void                   => { store.delete(userId); },
  has:  (userId: number): boolean                => store.has(userId),
};
