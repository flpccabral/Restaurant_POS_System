"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorStateProps {
  message?: string;
  description?: string;
  onRetry?: () => void;
}

/**
 * ErrorState — displays a centered error card with optional retry button.
 * Use in pages when a React Query `isError` is true.
 *
 * @example
 * ```tsx
 * if (isError) return <ErrorState message="Falha ao carregar..." onRetry={refetch} />
 * ```
 */
export function ErrorState({
  message = "Algo deu errado.",
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-critical/10 shrink-0">
              <AlertTriangle className="h-5 w-5 text-critical" />
            </div>
            <CardTitle className="text-lg">{message}</CardTitle>
          </div>
        </CardHeader>
        {description && (
          <CardContent>
            <p className="text-sm text-muted-foreground">{description}</p>
          </CardContent>
        )}
        {onRetry && (
          <CardFooter>
            <Button
              variant="outline"
              onClick={onRetry}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
