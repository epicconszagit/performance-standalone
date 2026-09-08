import { apiClient } from "./client";

export const getMyProfile = () => apiClient.get("/employees/me");
export const updateMyProfile = (data) => apiClient.patch("/employees/me", data);
