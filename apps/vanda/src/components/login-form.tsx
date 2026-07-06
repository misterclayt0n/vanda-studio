import { SignIn } from "@clerk/tanstack-react-start";

export function LoginForm() {
  return (
    <div className="flex justify-center">
      <SignIn fallbackRedirectUrl="/" signUpUrl="/login" />
    </div>
  );
}
