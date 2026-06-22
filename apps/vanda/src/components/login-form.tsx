import type { FormEvent } from "react";
import { useState } from "react";
import { useSignIn } from "@clerk/tanstack-react-start/legacy";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@vanda-studio/ui/components/button";
import { Input } from "@vanda-studio/ui/components/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@vanda-studio/ui/components/input-otp";

type Step = "start" | "code" | "password";

function GoogleIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.16a5.27 5.27 0 01-2.28 3.46v2.86h3.68C21.7 18.7 23 15.76 23 12.27z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.08 0 5.66-1.02 7.55-2.76l-3.68-2.86c-1.02.69-2.33 1.1-3.87 1.1-2.97 0-5.49-2-6.39-4.7H1.81v2.95A12 12 0 0012 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.61 14.78a7.2 7.2 0 010-4.56V7.27H1.81a12 12 0 000 9.46l3.8-2.95z"
      />
      <path
        fill="#EA4335"
        d="M12 4.74c1.67 0 3.18.58 4.36 1.7l3.27-3.27C17.65 1.2 15.07 0 12 0A12 12 0 001.81 7.27l3.8 2.95C6.51 6.74 9.03 4.74 12 4.74z"
      />
    </svg>
  );
}

const FIELD_LABEL = "mb-2 block text-[13px] font-medium text-foreground";

function clerkErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "errors" in err) {
    const { errors } = err;
    if (Array.isArray(errors) && errors.length > 0) {
      const first: unknown = errors[0];
      if (
        first &&
        typeof first === "object" &&
        "message" in first &&
        typeof first.message === "string"
      ) {
        return first.message;
      }
    }
  }
  return "Algo deu errado. Tente novamente.";
}

export function LoginForm() {
  const clerk = useSignIn();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("start");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function complete(sessionId: string | null) {
    if (!clerk.isLoaded || !sessionId) return;
    await clerk.setActive({ session: sessionId });
    await navigate({ to: "/" });
  }

  async function handleGoogle() {
    if (!clerk.isLoaded) return;
    setError(null);
    try {
      await clerk.signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err) {
      setError(clerkErrorMessage(err));
    }
  }

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clerk.isLoaded || !email) return;
    setError(null);
    setBusy(true);
    try {
      const attempt = await clerk.signIn.create({ identifier: email });
      if (attempt.status === "complete") {
        await complete(attempt.createdSessionId);
        return;
      }
      const factors = attempt.supportedFirstFactors ?? [];
      const emailCode = factors.find((factor) => factor.strategy === "email_code");
      if (emailCode) {
        await clerk.signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: emailCode.emailAddressId,
        });
        setStep("code");
        return;
      }
      if (factors.some((factor) => factor.strategy === "password")) {
        setStep("password");
        return;
      }
      setError("Este e-mail não pode entrar por aqui.");
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clerk.isLoaded || code.length < 6) return;
    setError(null);
    setBusy(true);
    try {
      const attempt = await clerk.signIn.attemptFirstFactor({
        strategy: "email_code",
        code,
      });
      if (attempt.status === "complete") {
        await complete(attempt.createdSessionId);
      } else {
        setError("Código inválido. Tente novamente.");
      }
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handlePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clerk.isLoaded || !password) return;
    setError(null);
    setBusy(true);
    try {
      const attempt = await clerk.signIn.attemptFirstFactor({
        strategy: "password",
        password,
      });
      if (attempt.status === "complete") {
        await complete(attempt.createdSessionId);
      } else {
        setError("Senha incorreta.");
      }
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? (
        <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      {step === "start" ? (
        <>
          <form onSubmit={handleStart} className="flex flex-col gap-[18px]">
            <label className="block">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                  className="h-[50px] pl-10"
                />
              </div>
            </label>
            <Button type="submit" variant="brand" size="xl" disabled={busy}>
              Continuar
              <ArrowRight className="size-[17px]" />
            </Button>
          </form>

          <div className="flex items-center gap-3.5">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11.5px] text-muted-foreground">ou continue com</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" variant="outline" size="xl" onClick={handleGoogle}>
            <GoogleIcon />
            Continuar com Google
          </Button>
        </>
      ) : null}

      {step === "code" ? (
        <form onSubmit={handleCode} className="flex flex-col gap-[18px]">
          <p className="text-[13px] leading-[1.5] text-muted-foreground">
            Enviamos um código para <span className="font-semibold text-foreground">{email}</span>.
          </p>
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            containerClassName="justify-center"
          >
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} className="size-12 rounded-lg border text-[18px]" />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <Button type="submit" variant="brand" size="xl" disabled={busy}>
            Verificar
          </Button>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => {
              setStep("start");
              setCode("");
              setError(null);
            }}
          >
            Usar outro e-mail
          </Button>
        </form>
      ) : null}

      {step === "password" ? (
        <form onSubmit={handlePassword} className="flex flex-col gap-[18px]">
          <label className="block">
            <span className={FIELD_LABEL}>Senha</span>
            <Input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-[50px]"
            />
          </label>
          <Button type="submit" variant="brand" size="xl" disabled={busy}>
            Entrar
          </Button>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => {
              setStep("start");
              setPassword("");
              setError(null);
            }}
          >
            Usar outro e-mail
          </Button>
        </form>
      ) : null}
    </div>
  );
}
