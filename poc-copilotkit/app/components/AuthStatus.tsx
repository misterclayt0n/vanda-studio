"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

export function AuthStatus() {
  const { isLoaded, isSignedIn, user } = useUser();

  return (
    <section className="auth-panel" aria-label="Authentication status">
      <span className={`session-dot ${isSignedIn ? "live" : "demo"}`} />
      <div className="auth-copy">
        <span className="auth-label">{isSignedIn ? "Convex live" : "Demo fallback"}</span>
        {!isLoaded ? <p>Checking Clerk session...</p> : null}
        {isLoaded && isSignedIn ? (
          <p>
            <strong>{user?.primaryEmailAddress?.emailAddress ?? user?.username ?? user?.id}</strong>
          </p>
        ) : null}
        {isLoaded && !isSignedIn ? <p>Sign in for synced Instagram data</p> : null}
      </div>

      {isLoaded && isSignedIn ? (
        <UserButton />
      ) : null}
      {isLoaded && !isSignedIn ? (
        <SignInButton mode="modal">
          <button className="auth-button" type="button">
            Sign in
          </button>
        </SignInButton>
      ) : null}
    </section>
  );
}
