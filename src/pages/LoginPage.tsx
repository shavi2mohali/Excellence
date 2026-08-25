import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { AuthAccessError, useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const { firebaseUser, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";

  if (firebaseUser) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (signInError) {
      if (signInError instanceof AuthAccessError && signInError.status === "pending") {
        if (signInError.summary) {
          sessionStorage.setItem("coeRegistrationPending", JSON.stringify(signInError.summary));
        }
        navigate("/registration-pending", { replace: true, state: signInError.summary });
        return;
      }
      setError(signInError instanceof Error ? signInError.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand-lockup large">
          <div className="emblem">
            <ShieldCheck size={28} />
          </div>
          <div>
            <span className="department">SCERT Punjab</span>
            <strong>Centre of Excellence PMIS</strong>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
          <Link className="text-link" to="/register">New user? Register</Link>
        </form>
      </section>
    </main>
  );
}
