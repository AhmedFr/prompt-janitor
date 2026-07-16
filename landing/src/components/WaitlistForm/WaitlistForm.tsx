import type { WaitlistFormProps } from "./WaitlistForm.types";

export function WaitlistForm({ source }: WaitlistFormProps) {
  return <p className="wl-msg" data-source={source}>Waitlist opens soon.</p>;
}
