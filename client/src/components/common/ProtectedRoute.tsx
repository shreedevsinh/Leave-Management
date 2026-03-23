import { Navigate } from "react-router-dom";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

interface Props {
  children: React.ReactNode;
  allowedRoles: string[];
}

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  exp: number;
}

function ProtectedRoute({ children, allowedRoles }: Props) {
  const token = Cookies.get("access_token");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  try {
    const decoded: TokenPayload = jwtDecode(token);

    // ❌ Role not allowed
    if (!allowedRoles.includes(decoded.role)) {
      return <Navigate to="/unauthorized" replace />;
    }


    return <>{children}</>;
  } catch (err) {
    return <Navigate to="/" replace />;
  }
}

export default ProtectedRoute;