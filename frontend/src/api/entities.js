import { apiClient } from "./client";

/**
 * Replicates the base44 SDK's per-entity shape (list/filter/create/update/delete)
 * so page components that called `base44.entities.X.method(...)` keep working
 * with only their import swapped out.
 */
function makeEntity(path) {
  return {
    list: (sort, limit) => apiClient.get(`/${path}`, { sort, limit }),
    filter: (query = {}) => apiClient.get(`/${path}`, query),
    create: (data) => apiClient.post(`/${path}`, data),
    update: (id, data) => apiClient.patch(`/${path}/${id}`, data),
    delete: (id) => apiClient.delete(`/${path}/${id}`),
    // No realtime push channel in the Flask backend - callers poll instead.
    subscribe: () => () => {},
  };
}

export const ActionItem = makeEntity("action-items");
export const Announcement = makeEntity("announcements");
export const AuditLog = makeEntity("audit-logs");
export const CompanyBranding = makeEntity("company-brandings");
export const Department = makeEntity("departments");
export const Employee = makeEntity("employees");
export const Meeting = makeEntity("meetings");
export const MeetingMinutes = makeEntity("meeting-minutes");
export const Notification = makeEntity("notifications");
export const PerformanceReport = makeEntity("performance-reports");
export const Report = makeEntity("reports");
export const Task = makeEntity("tasks");
export const TodoItem = makeEntity("todo-items");
