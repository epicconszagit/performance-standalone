import { apiClient } from "./client";

export const listPendingUsers = () => apiClient.get("/pending-users");
export const approveUser = (userId, data) => apiClient.post(`/pending-users/${userId}/approve`, data);
export const rejectUser = (userId) => apiClient.post(`/pending-users/${userId}/reject`);
