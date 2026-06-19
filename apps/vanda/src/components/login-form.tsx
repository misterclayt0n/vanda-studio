import type { FormEvent } from "react";
import { useState } from "react";
import { useSignIn } from "@clerk/tanstack-react-start/legacy";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Mail } from "lucide-react";

type Step = "start" | "code" | "password";

function GoogleIcon() {
	return (
		<svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true">
			<path fill="#4285F4" d="M23 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.16a5.27 5.27 0 01-2.28 3.46v2.86h3.68C21.7 18.7 23 15.76 23 12.27z" />
			<path fill="#34A853" d="M12 24c3.08 0 5.66-1.02 7.55-2.76l-3.68-2.86c-1.02.69-2.33 1.1-3.87 1.1-2.97 0-5.49-2-6.39-4.7H1.81v2.95A12 12 0 0012 24z" />
			<path fill="#FBBC05" d="M5.61 14.78a7.2 7.2 0 010-4.56V7.27H1.81a12 12 0 000 9.46l3.8-2.95z" />
			<path fill="#EA4335" d="M12 4.74c1.67 0 3.18.58 4.36 1.7l3.27-3.27C17.65 1.2 15.07 0 12 0A12 12 0 001.81 7.27l3.8 2.95C6.51 6.74 9.03 4.74 12 4.74z" />
		</svg>
	);
}

function clerkErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "errors" in err) {
		const { errors } = err;
		if (Array.isArray(errors) && errors.length > 0) {
			const first: unknown = errors[0];
			if (first && typeof first === "object" && "message" in first && typeof first.message === "string") {
				return first.message;
			}
		}
	}
	return "Algo deu errado. Tente novamente.";
}

const PRIMARY_BUTTON =
	"flex h-[50px] w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-br from-[#ee7aaa] to-[#c4277f] text-[14.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_24px_-8px_rgba(196,39,127,0.6)] transition-transform duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";

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
		if (!clerk.isLoaded || !code) return;
		setError(null);
		setBusy(true);
		try {
			const attempt = await clerk.signIn.attemptFirstFactor({ strategy: "email_code", code });
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
			const attempt = await clerk.signIn.attemptFirstFactor({ strategy: "password", password });
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
				<p className="rounded-[10px] border border-[rgba(242,113,158,0.25)] bg-[rgba(242,113,158,0.1)] px-3.5 py-2.5 text-[13px] text-[#f2719e]">
					{error}
				</p>
			) : null}

			{step === "start" ? (
				<>
					<form onSubmit={handleStart} className="flex flex-col gap-[18px]">
						<label className="block">
							<span className="mb-[9px] block font-mono text-[10.5px] tracking-[0.14em] text-[#6a6e76]">
								E-MAIL DE TRABALHO
							</span>
							<span className="flex h-[50px] items-center gap-2.5 rounded-[11px] border border-[#262029] bg-[#0f0d12] px-3.5 transition-colors focus-within:border-[#ee7aaa]">
								<Mail className="size-[18px] shrink-0 text-[#5a5560]" />
								<input
									type="email"
									required
									autoComplete="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="voce@empresa.com"
									className="h-full flex-1 bg-transparent text-[14px] text-[#f7f8f8] outline-none placeholder:text-[#54515a]"
								/>
							</span>
						</label>
						<button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
							Continuar
							<ArrowRight className="size-[17px]" />
						</button>
					</form>

					<div className="flex items-center gap-3.5">
						<span className="h-px flex-1 bg-[#1c1a22]" />
						<span className="text-[11.5px] text-[#5a5560]">ou continue com</span>
						<span className="h-px flex-1 bg-[#1c1a22]" />
					</div>

					<button
						type="button"
						onClick={handleGoogle}
						className="flex h-12 w-full items-center justify-center gap-[11px] rounded-[11px] border border-[#232027] bg-[#100e13] text-[14px] font-semibold text-[#e6e7ea] transition-colors duration-150 hover:border-[#2e2a33] hover:bg-[#16131b]"
					>
						<GoogleIcon />
						Continuar com Google
					</button>
				</>
			) : null}

			{step === "code" ? (
				<form onSubmit={handleCode} className="flex flex-col gap-[18px]">
					<p className="text-[13px] leading-[1.5] text-[#8a8f98]">
						Enviamos um código para <span className="font-semibold text-[#f7f8f8]">{email}</span>.
					</p>
					<label className="block">
						<span className="mb-[9px] block font-mono text-[10.5px] tracking-[0.14em] text-[#6a6e76]">
							CÓDIGO DE VERIFICAÇÃO
						</span>
						<input
							inputMode="numeric"
							autoComplete="one-time-code"
							required
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="000000"
							className="h-[50px] w-full rounded-[11px] border border-[#262029] bg-[#0f0d12] px-3.5 text-center font-mono text-[18px] tracking-[0.4em] text-[#f7f8f8] outline-none transition-colors placeholder:text-[#3c3a42] focus:border-[#ee7aaa]"
						/>
					</label>
					<button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
						Verificar
					</button>
					<button
						type="button"
						onClick={() => {
							setStep("start");
							setCode("");
							setError(null);
						}}
						className="text-[12.5px] text-[#8a8f98] transition-colors hover:text-[#ee7aaa]"
					>
						Usar outro e-mail
					</button>
				</form>
			) : null}

			{step === "password" ? (
				<form onSubmit={handlePassword} className="flex flex-col gap-[18px]">
					<label className="block">
						<span className="mb-[9px] block font-mono text-[10.5px] tracking-[0.14em] text-[#6a6e76]">
							SENHA
						</span>
						<input
							type="password"
							autoComplete="current-password"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							className="h-[50px] w-full rounded-[11px] border border-[#262029] bg-[#0f0d12] px-3.5 text-[14px] text-[#f7f8f8] outline-none transition-colors placeholder:text-[#54515a] focus:border-[#ee7aaa]"
						/>
					</label>
					<button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
						Entrar
					</button>
					<button
						type="button"
						onClick={() => {
							setStep("start");
							setPassword("");
							setError(null);
						}}
						className="text-[12.5px] text-[#8a8f98] transition-colors hover:text-[#ee7aaa]"
					>
						Usar outro e-mail
					</button>
				</form>
			) : null}
		</div>
	);
}
