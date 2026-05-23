import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { getTimeline } from "../../https";
import StatusBadge from "./StatusBadge";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";
import EmptyState from "./EmptyState";
import {
  MdSwapHoriz,
  MdFactory,
  MdWarning,
  MdAdd,
  MdRemove,
} from "react-icons/md";

const eventTypeIcons = {
  addition: <MdAdd className="text-[#2ed573]" />,
  deduction: <MdRemove className="text-[#ff6b6b]" />,
  transfer_in: <MdSwapHoriz className="text-[#54a0ff]" />,
  transfer_out: <MdSwapHoriz className="text-[#feca57]" />,
  production_completed: <MdFactory className="text-[#a29bfe]" />,
  stockout: <MdWarning className="text-[#ff6b6b]" />,
  critical_stock: <MdWarning className="text-[#ff9f43]" />,
};

const TimelineTab = () => {
  const user = useSelector((state) => state.user);
  const storeId = user.store?._id;

  const [typeFilter, setTypeFilter] = useState("all");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["timeline", storeId],
    queryFn: () => getTimeline({ limit: 100 }),
    enabled: !!storeId,
    staleTime: 60_000,
  });

  if (!storeId) {
    return <EmptyState message="Nenhuma loja associada ao usuário." />;
  }

  if (isLoading) return <LoadingState rows={8} />;
  if (isError)
    return (
      <ErrorState
        message="Falha ao carregar timeline operacional."
        onRetry={refetch}
      />
    );

  const events = data?.data?.events || [];

  const filtered =
    typeFilter === "all"
      ? events
      : events.filter((e) => e.type === typeFilter);

  if (events.length === 0) {
    return <EmptyState message="Nenhum evento operacional registrado." />;
  }

  const eventTypes = [
    { value: "all", label: "Todos" },
    { value: "movement", label: "Movimentações" },
    { value: "production", label: "Produções" },
    { value: "alert", label: "Alertas" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {eventTypes.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setTypeFilter(tab.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              typeFilter === tab.value
                ? "bg-[#333] text-[#f5f5f5]"
                : "bg-[#1a1a1a] text-[#ababab] hover:bg-[#262626]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="Nenhum evento com este filtro." />
      ) : (
        <div className="space-y-2">
          {filtered.map((event, idx) => {
            const icon =
              eventTypeIcons[event.eventType] || eventTypeIcons[event.type] || (
                <div className="w-4 h-4 rounded-full bg-[#555]" />
              );
            const timestamp = new Date(
              event.timestamp
            ).toLocaleString("pt-BR");

            return (
              <div
                key={`${event.type}-${idx}-${event.timestamp}`}
                className="bg-[#1a1a1a] rounded-lg p-3 flex items-start gap-3"
              >
                <span className="text-lg mt-0.5">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-[#f5f5f5] text-sm font-medium">
                      {event.eventType || event.type}
                    </span>
                    {event.severity && (
                      <StatusBadge type="severity" value={event.severity} />
                    )}
                    {event.ingredient && (
                      <span className="text-[#ababab] text-xs">
                        {event.ingredient}
                      </span>
                    )}
                  </div>

                  {event.type === "movement" && (
                    <div className="text-xs text-[#ababab] space-x-3">
                      <span>
                        Qtd:{" "}
                        <span className="text-[#f5f5f5]">
                          {event.quantity}
                          {event.unit}
                        </span>
                      </span>
                      {event.location && <span>{event.location}</span>}
                      {event.reason && (
                        <span className="text-[#666]">{event.reason}</span>
                      )}
                    </div>
                  )}

                  {event.type === "production" && (
                    <div className="text-xs text-[#ababab]">
                      <span>
                        Outputs:{" "}
                        {event.outputs
                          ?.map(
                            (o) =>
                              `${o.ingredient} (${o.quantity}${o.unit})`
                          )
                          .join(", ") || "-"}
                      </span>
                      {event.user && (
                        <span className="ml-3 text-[#666]">
                          por {event.user}
                        </span>
                      )}
                    </div>
                  )}

                  {event.type === "alert" && event.message && (
                    <p className="text-[#ababab] text-xs mt-0.5">
                      {event.message}
                    </p>
                  )}

                  <span className="text-[#555] text-xs mt-1 block">
                    {timestamp}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TimelineTab;
