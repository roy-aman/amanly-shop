/* Injects the Razorpay Checkout script once and resolves when it's ready. */
let promise: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve();
  if (promise) return promise;
  promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => {
      promise = null;
      reject(new Error('Failed to load the payment gateway'));
    };
    document.head.appendChild(script);
  });
  return promise;
}
