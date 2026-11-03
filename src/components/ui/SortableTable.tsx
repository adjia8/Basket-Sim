"use client";

import { useMemo, useState, type ReactNode } from "react";

export interface SortableColumn {
  label: string;
  align?: "left" | "right";
  // false : colonne d'action, pas de tri.
  sortable?: boolean;
  // Premier clic en ordre décroissant (notes, salaires...) plutôt que
  // croissant (noms, rangs).
  descendingFirst?: boolean;
}

export interface SortableRow {
  key: string;
  // Une cellule par colonne, déjà rendue côté serveur (liens, couleurs,
  // boutons de formulaire...).
  cells: ReactNode[];
  // Valeur de tri par colonne (null : en dernier quel que soit le sens).
  sortValues: (string | number | null)[];
  highlight?: boolean;
}

// Tableau triable façon Football Manager : clic sur un en-tête pour trier,
// re-clic pour inverser. Le contenu des cellules vient du serveur, seul
// l'ordre des lignes est géré ici.
export function SortableTable({
  columns,
  rows,
  initialSort,
  minWidth,
}: {
  columns: SortableColumn[];
  rows: SortableRow[];
  initialSort?: { column: number; descending: boolean };
  minWidth?: number;
}) {
  const [sort, setSort] = useState<{ column: number; descending: boolean } | null>(initialSort ?? null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const direction = sort.descending ? -1 : 1;
    return [...rows].sort((a, b) => {
      const va = a.sortValues[sort.column];
      const vb = b.sortValues[sort.column];
      if (va === null || va === undefined) return vb === null || vb === undefined ? 0 : 1;
      if (vb === null || vb === undefined) return -1;
      const diff = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return diff * direction;
    });
  }, [rows, sort]);

  function toggle(column: number) {
    setSort((current) =>
      current?.column === column
        ? { column, descending: !current.descending }
        : { column, descending: Boolean(columns[column].descendingFirst) }
    );
  }

  return (
    <table className="data-table w-full text-left text-sm" style={minWidth ? { minWidth } : undefined}>
      <thead>
        <tr>
          {columns.map((col, i) => {
            const active = sort?.column === i;
            const alignRight = col.align === "right";
            return (
              <th
                key={col.label + i}
                className={`py-2 ${i < columns.length - 1 ? "pr-4" : ""} ${alignRight ? "text-right" : ""}`}
                aria-sort={active ? (sort.descending ? "descending" : "ascending") : undefined}
              >
                {col.sortable === false ? (
                  col.label
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className={`inline-flex items-center gap-1 uppercase tracking-[inherit] transition hover:text-fg ${
                      active ? "text-accent-text" : ""
                    }`}
                  >
                    {col.label}
                    {active && <span aria-hidden>{sort.descending ? "↓" : "↑"}</span>}
                  </button>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row) => (
          <tr key={row.key} className={row.highlight ? "bg-accent/10" : undefined}>
            {row.cells.map((cell, i) => (
              <td
                key={i}
                className={`py-2 ${i < row.cells.length - 1 ? "pr-4" : ""} ${
                  columns[i]?.align === "right" ? "text-right" : ""
                }`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
