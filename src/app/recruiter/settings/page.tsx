"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Calendar, CheckCircle, AlertCircle } from "lucide-react";

type CalendarStatus = "checking" | "connected" | "disconnected";

export default function RecruiterSettings() {
  const { user } = useAuth();
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>("checking");

  useEffect(() => {
    if (!user) return;
    fetch("/api/calendar/status")
      .then((r) => r.json())
      .then((data: { connected: boolean }) =>
        setCalendarStatus(data.connected ? "connected" : "disconnected")
      )
      .catch(() => setCalendarStatus("disconnected"));

    // Show success banner if redirected back from OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar_connected") === "1") {
      setCalendarStatus("connected");
      window.history.replaceState({}, "", "/recruiter/settings");
    }
  }, [user]);

  function connectCalendar() {
    // Kicks off Google OAuth flow via /api/calendar/auth (P6 builds this)
    window.location.href = "/api/calendar/auth";
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account integrations</p>
      </div>

      <div className="bg-white border rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Calendar size={20} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">Google Calendar</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Connect your Google account to automatically schedule interview events when you approve
              candidates.
            </p>

            <div className="mt-4">
              {calendarStatus === "checking" && (
                <div className="h-8 w-32 bg-gray-100 rounded-lg animate-pulse" />
              )}

              {calendarStatus === "connected" && (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle size={16} />
                  <span className="text-sm font-medium">Connected</span>
                </div>
              )}

              {calendarStatus === "disconnected" && (
                <div>
                  <div className="flex items-center gap-2 text-amber-600 mb-3">
                    <AlertCircle size={16} />
                    <span className="text-sm">Not connected</span>
                  </div>
                  <button
                    onClick={connectCalendar}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                  >
                    <Calendar size={15} />
                    Connect Google Calendar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
