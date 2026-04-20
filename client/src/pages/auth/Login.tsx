import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import Toast from "../../components/common/Toast";

interface LoginForm {
  email: string;
  password: string;
  remember?: boolean;
}

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  exp: number;
}

export default function Login() {
  const API_URL = import.meta.env.VITE_API_URL;

  const navigate = useNavigate();

  const [form, setForm] = useState<LoginForm>({
    email: "",
    password: "",
    remember: false,
  });

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Stable particles
  const particles = useMemo(
    () =>
      [...Array(30)].map(() => ({
        top: Math.random() * 100,
        left: Math.random() * 100,
      })),
    []
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        setToast({
          message: res.statusText || "Login failed",
          type: "error",
        });
      }

      const data = await res.json();

      // Save token
      Cookies.set("access_token", data.access_token, {
        expires: form.remember ? 7 : undefined,
      });

      // Decode token
      const decoded: TokenPayload = jwtDecode(data.access_token);

      // Redirect based on role
      if (decoded.role === "ADMIN") {
        navigate("/admin/dashboard", {
          state: { message: "Login successful", type: "success" },
        });
      } else if (decoded.role === "EMPLOYEE") {
        navigate("/employee/dashboard", {
          state: { message: "Login successful", type: "success" },
        });
      } else {
        navigate("/unauthorized");
      }

      // Reset form
      setForm({ email: "", password: "", remember: false });

    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <>
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#0b2239] to-[#0f1e33]">

        {/* 🌕 Moon */}
        <div className="absolute top-16 right-20 z-[1] animate-[float_6s_ease-in-out_infinite]">
          <div className="absolute inset-0 w-24 h-24 bg-white/20 rounded-full blur-2xl"></div>
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-white to-gray-300 overflow-hidden shadow-[0_0_40px_rgba(255,255,255,0.3)]">
            <span className="absolute w-3 h-3 bg-gray-300/40 rounded-full top-4 left-5"></span>
            <span className="absolute w-2 h-2 bg-gray-400/40 rounded-full top-10 left-10"></span>
            <span className="absolute w-2.5 h-2.5 bg-gray-300/30 rounded-full bottom-4 right-6"></span>
          </div>
        </div>

        {/* 🌟 Particles */}
        <div className="absolute inset-0 z-0">
          {particles.map((p, i) => (
            <span
              key={i}
              className="absolute w-2 h-2 bg-white/20 rounded-full animate-pulse"
              style={{
                top: `${p.top}%`,
                left: `${p.left}%`,
              }}
            />
          ))}
        </div>

        {/* 🔐 Login Card */}
        <div className="relative z-10 w-full max-w-md mx-auto px-6 py-8 bg-[#13263f]/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10">

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-teal-400 flex items-center justify-center text-white text-lg font-bold shadow-lg">
              R
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-semibold text-white text-center mb-2">
            Sign in
          </h2>
          <p className="text-center text-gray-300 mb-6 text-sm">
            Sign in and start managing your dashboard!
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <input
              type="text"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Login"
              className="w-full p-3 bg-[#1b3554] border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
              required
            />

            {/* Password */}
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Password"
              className="w-full p-3 bg-[#1b3554] border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
              required
            />

            {/* Remember */}
            <div className="flex items-center justify-between text-sm text-gray-300">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="remember"
                  checked={form.remember}
                  onChange={handleChange}
                  className="accent-green-400"
                />
                Remember
              </label>
              <span className="text-green-400 cursor-pointer hover:underline">
                Forgot Password?
              </span>
            </div>

            {/* Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-green-400 to-teal-400 hover:opacity-90 transition p-3 rounded-xl text-[#0f1e33] font-semibold shadow-md"
            >
              Login
            </button>
          </form>
        </div>

        {/* 🌊 Waves */}
        <div className="absolute bottom-0 left-0 w-full h-[260px] z-0 overflow-hidden">
          <svg viewBox="0 0 1440 320" className="absolute bottom-0 left-0 w-full z-[1]">
            <path fill="#0f2747" d="M0,224L80,208C160,192,320,160,480,154.7C640,149,800,171,960,192C1120,213,1280,235,1360,245.3L1440,256V320H0Z" />
          </svg>
          <svg viewBox="0 0 1440 320" className="absolute bottom-0 left-0 w-full z-[2] opacity-80 translate-y-[10px]">
            <path fill="#163a63" d="M0,256L60,245.3C120,235,240,213,360,197.3C480,181,600,171,720,186.7C840,203,960,245,1080,250.7C1200,256,1320,224,1380,208L1440,192V320H0Z" />
          </svg>
          <svg viewBox="0 0 1440 320" className="absolute bottom-0 left-0 w-full z-[3] opacity-70 blur-[1px] translate-y-[20px]">
            <path fill="#1e4d7a" d="M0,288L80,272C160,256,320,224,480,208C640,192,800,192,960,208C1120,224,1280,256,1360,272L1440,288V320H0Z" />
          </svg>
          <svg viewBox="0 0 1440 320" className="absolute bottom-0 left-0 w-full z-[4] translate-y-[30px]">
            <path fill="#e5e7eb" d="M0,304L60,293.3C120,283,240,261,360,250.7C480,240,600,240,720,250.7C840,261,960,283,1080,282.7C1200,283,1320,261,1380,250.7L1440,240V320H0Z" />
          </svg>
        </div>

        {/* Float animation */}
        <style>
          {`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        `}
        </style>
      </div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}