"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChefHat, Loader2 } from "lucide-react";
import { authService } from "@/services/api/auth";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authService.login({ email, password });
      toast.success("Login realizado com sucesso");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Email ou senha inválidos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-brand-muted blur-3xl opacity-30" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-brand-muted blur-3xl opacity-20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-brand-muted blur-3xl opacity-[0.08]" />
      </div>

      <div className="relative w-full max-w-md px-4">
        <Card className="border border-border/50 shadow-2xl shadow-black/20 backdrop-blur-sm">
          <CardHeader className="text-center space-y-5 pb-6">
            {/* Brand icon */}
            <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-muted flex items-center justify-center">
              <ChefHat className="h-7 w-7 text-brand" />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-2xl font-bold tracking-tight">POS Admin</CardTitle>
              <CardDescription className="text-sm">
                Acesse o painel administrativo do sistema
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10"
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-brand transition-colors"
                    onClick={() => toast.info("Entre em contato com o suporte para redefinir sua senha.")}
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10"
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-10"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Entrando…
                </>
              ) : (
                "Entrar"
              )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          Gastronomic Operational Intelligence Platform
        </p>
      </div>
    </div>
  );
}
