import { useEffect } from "react";
import { CheckCircle, XCircle } from "lucide-react";

interface ToastProps {
    message: string;
    type: "success" | "error";
    onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="fixed bottom-5 right-5 z-[999] animate-in fade-in slide-in-from-top-5">
            <div
                className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border 
                ${type === "success"
                        ? "bg-green-500/10 border-green-500 text-green-400"
                        : "bg-red-500/10 border-red-500 text-red-400"
                    }`}
            >
                {type === "success" ? (
                    <CheckCircle size={20} />
                ) : (
                    <XCircle size={20} />
                )}

                <span className="text-sm font-medium">{message}</span>
            </div>
        </div>
    );
}