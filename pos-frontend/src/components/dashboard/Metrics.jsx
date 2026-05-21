import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDashboardKPIs } from "../../https";
import { itemsData } from "../../constants";

const Metrics = () => {
  const [period, setPeriod] = useState("30days");

  const { data: kpiData, isLoading, isError } = useQuery({
    queryKey: ["dashboardKPIs", period],
    queryFn: async () => {
      const response = await getDashboardKPIs({ period });
      return response.data;
    },
  });

  if (isLoading) return <div className="text-white p-6">Loading metrics...</div>;
  if (isError) return <div className="text-red-500 p-6">Failed to load metrics.</div>;

  // Format real backend data into the UI structure
  const metricsData = [
    {
      title: "Revenue",
      value: `₹${kpiData?.data?.revenue?.total?.toFixed(2) || "0.00"}`,
      percentage: "0%",
      color: "#025cca",
      isIncrease: true
    },
    {
      title: "Gross Margin",
      value: `₹${kpiData?.data?.margins?.grossAmount?.toFixed(2) || "0.00"}`,
      percentage: `${kpiData?.data?.margins?.gross || "0"}%`,
      color: "#02ca3a",
      isIncrease: true
    },
    {
      title: "Total Orders",
      value: kpiData?.data?.revenue?.orders || 0,
      percentage: "0%",
      color: "#f6b100",
      isIncrease: true
    },
    {
      title: "Pending Orders",
      value: kpiData?.data?.operational?.pendingOrders || 0,
      percentage: "0%",
      color: "#be3e3f",
      isIncrease: false
    },
  ];

  return (
    <div className="container mx-auto py-2 px-6 md:px-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-semibold text-[#f5f5f5] text-xl">
            Overall Performance
          </h2>
          <p className="text-sm text-[#ababab]">
            Real-time analytics fetched directly from your store's backend.
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="flex items-center gap-1 px-4 py-2 rounded-md text-[#f5f5f5] bg-[#1a1a1a] border-none outline-none cursor-pointer"
        >
          <option value="today">Today</option>
          <option value="this_week">This Week</option>
          <option value="30days">Last 30 Days</option>
          <option value="this_year">This Year</option>
        </select>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4">
        {metricsData.map((metric, index) => {
          return (
            <div
              key={index}
              className="shadow-sm rounded-lg p-4"
              style={{ backgroundColor: metric.color }}
            >
              <div className="flex justify-between items-center">
                <p className="font-medium text-xs text-[#f5f5f5]">
                  {metric.title}
                </p>
                <div className="flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    style={{ color: metric.isIncrease ? "#f5f5f5" : "red" }}
                  >
                    <path
                      d={metric.isIncrease ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
                    />
                  </svg>
                  <p
                    className="font-medium text-xs"
                    style={{ color: metric.isIncrease ? "#f5f5f5" : "red" }}
                  >
                    {metric.percentage}
                  </p>
                </div>
              </div>
              <p className="mt-1 font-semibold text-2xl text-[#f5f5f5]">
                {metric.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col justify-between mt-12">
        <div>
          <h2 className="font-semibold text-[#f5f5f5] text-xl">
            Item Details
          </h2>
          <p className="text-sm text-[#ababab]">
            Other operational metrics.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-4">
            {itemsData.map((item, index) => {
                return (
                    <div key={index} className="shadow-sm rounded-lg p-4" style={{ backgroundColor: item.color }}>
                    <div className="flex justify-between items-center">
                      <p className="font-medium text-xs text-[#f5f5f5]">{item.title}</p>
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4" fill="none">
                          <path d="M5 15l7-7 7 7" />
                        </svg>
                        <p className="font-medium text-xs text-[#f5f5f5]">{item.percentage}</p>
                      </div>
                    </div>
                    <p className="mt-1 font-semibold text-2xl text-[#f5f5f5]">{item.value}</p>
                  </div>
                )
            })}
        </div>
      </div>
    </div>
  );
};

export default Metrics;
