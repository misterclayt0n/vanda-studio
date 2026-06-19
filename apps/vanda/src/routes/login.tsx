import { useUser } from "@clerk/tanstack-react-start";
import { Navigate, createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "../components/login-form";
import { OrchidAperture } from "../components/orchid-aperture";
import { VandaMark } from "../components/vanda-mark";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return <Navigate to="/" />;
  }

  return (
    <div className="flex min-h-svh overflow-hidden bg-[#070509] text-[#f7f8f8] antialiased">
      <div className="relative flex w-full shrink-0 flex-col border-r border-[#15131a] px-6 py-[46px] sm:px-14 lg:w-[47%] lg:max-w-[720px]">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="w-[380px] max-w-full">
            <div className="mb-9 flex flex-col items-center text-center">
              <div className="mb-[22px]">
                <VandaMark size={40} />
              </div>
              <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em]">
                Entrar na sua conta
              </h1>
            </div>

            <LoginForm />
          </div>
        </div>
      </div>

      <div
        className="relative hidden flex-1 items-center justify-center overflow-hidden lg:flex"
        style={{
          background:
            "radial-gradient(72% 58% at 50% 45%,#1c0f1a 0%,#120a13 52%,#09060b 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-[45%] size-[680px] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "radial-gradient(circle,rgba(224,86,143,0.32),rgba(224,86,143,0) 60%)",
          }}
        />
        <div className="relative z-10 size-[540px] max-w-[80%]">
          <OrchidAperture />
        </div>
      </div>
    </div>
  );
}
