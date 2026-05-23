"use client";

import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Column {
  key: string;
  header: string;
  className?: string;
  cell?: (row: unknown) => React.ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: unknown[];
  loading?: boolean;
  searchKey?: string;
  searchPlaceholder?: string;
  onCreate?: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  customActions?: (row: unknown) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
  /** Custom search function. Receives row and search term. Overrides searchKey. */
  onSearchField?: (row: unknown, term: string) => boolean;
  /** Number of rows per page. Default 20. Set to 0 to disable pagination. */
  pageSize?: number;
}

export function DataTable({
  columns,
  data,
  loading,
  searchKey,
  searchPlaceholder = "Pesquisar...",
  onCreate,
  onEdit,
  onDelete,
  customActions,
  emptyMessage = "Nenhum resultado encontrado.",
  className,
  onSearchField,
  pageSize = 20,
}: DataTableProps) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const items = Array.isArray(data) ? data : [];

  const filtered = useMemo(() => {
    if (!search || (!onSearchField && !searchKey)) return items;
    return items.filter((row) => {
      if (onSearchField) return onSearchField(row, search);
      return String((row as Record<string, unknown>)[searchKey!])
        .toLowerCase()
        .includes(search.toLowerCase());
    });
  }, [items, search, searchKey, onSearchField]);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;

  // Reset to page 1 when search results change
  useEffect(() => {
    // Only reset when search is active and current page exceeds new total
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    if (pageSize <= 0) return filtered;
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const displayData = pageSize > 0 ? paginatedData : filtered;

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-4">
        {searchKey && (
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
        {onCreate && (
          <Button onClick={onCreate} className="ml-auto">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>
                  {col.header}
                </TableHead>
              ))}
              {(onEdit || onDelete) && (
                <TableHead className="w-20 text-right">Acoes</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + ((onEdit || onDelete || customActions) ? 1 : 0)} className="text-center py-10 text-muted-foreground">
                  <div className="flex flex-col items-center gap-1">
                    <Search className="h-5 w-5 text-muted-foreground/50" />
                    <p>{emptyMessage}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayData.map((row, idx) => {
                const r = row as Record<string, unknown>;
                return (
                <TableRow key={String(r._id ?? idx)} className="group/data-row">
                  {columns.map((col) => (
                    <TableCell key={col.key} className={cn("text-foreground/80", col.className)}>
                      {col.cell ? col.cell(row) : String(r[col.key] ?? "")}
                    </TableCell>
                  ))}
                  {(onEdit || onDelete || customActions) && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover/data-row:opacity-100 transition-opacity duration-150">
                        {customActions && (
                          <div className="mr-1">
                            {customActions(row)}
                          </div>
                        )}
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onEdit(String(r._id))}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Editar</span>
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onDelete(String(r._id))}
                            className="text-muted-foreground hover:text-critical hover:bg-critical/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Excluir</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pageSize > 0 && filtered.length > pageSize && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
            {search && ` (filtrados de ${items.length})`}
          </p>
          <div className="flex items-center gap-3">
            <p className="text-muted-foreground">
              Pagina {safePage} de {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="sr-only">Pagina anterior</span>
              </Button>
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="sr-only">Proxima pagina</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
