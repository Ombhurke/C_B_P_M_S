'use client';
interface Props { isOpen: boolean; totalCost: number; currency: string; onClose: () => void; }
export default function PaymentModal({ isOpen, totalCost, currency, onClose }: Props) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#14100e]/85 backdrop-blur-md">
      <div role="dialog" aria-modal="true" aria-labelledby="checkout-title" className="glass-panel max-w-lg w-full p-8 rounded-3xl space-y-5">
        <h2 id="checkout-title" className="text-2xl font-bold">Online checkout is not available yet</h2>
        <p className="text-3xl font-semibold">{currency} {totalCost.toFixed(2)}</p>
        <p className="text-base text-[#ba9e88]">A live payment provider must be connected before this job can be paid for or released. No money has been taken.</p>
        <button autoFocus onClick={onClose} className="w-full py-4 rounded-xl bg-[#ea7c50] text-white text-lg">Back to your document</button>
      </div>
    </div>
  );
}
