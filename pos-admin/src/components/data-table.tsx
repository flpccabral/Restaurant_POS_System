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
          <Skeleton key={i} className="h-10 w-full bg-zinc-800" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-4">
        {searchKey && (
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>
        )}
        {onCreate && (
          <Button onClick={onCreate} className="bg-brand hover:bg-brand-muted text-brand-foreground ml-auto">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        )}
      </div>

      <div className="rounded-md border border-zinc-800 overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-900">
            <TableRow className="border-zinc-800">
              {columns.map((col) => (
                <TableHead key={col.key} className="text-zinc-400 font-medium">
                  {col.header}
                </TableHead>
              ))}
              {(onEdit || onDelete) && (
                <TableHead className="text-zinc-400 font-medium w-24">Ações</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="border-zinc-800">
                <TableCell colSpan={columns.length + 1} className="text-center py-8 text-zinc-500">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              displayData.map((row, idx) => {
                const r = row as Record<string, unknown>;
                return (
                <TableRow key={String(r._id ?? idx)} className="border-zinc-800">
                  {columns.map((col) => (
                    <TableCell key={col.key} className={cn("text-zinc-300", col.className)}>
                      {col.cell ? col.cell(row) : String(r[col.key] ?? "")}
                    </TableCell>
                  ))}
                  {(onEdit || onDelete) && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(String(r._id))}
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(String(r._id))}
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
          <p className="text-zinc-400">
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
            {search && ` (filtrados de ${items.length})`}
          </p>
          <div className="flex items-center gap-3">
            <p className="text-zinc-400">
              Página {safePage} de {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="xs"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="border-zinc-700 text-zinc-300"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="border-zinc-700 text-zinc-300"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
