import { apiClient } from "./client";

export const onboardEmployee = (data) => apiClient.post("/employees/onboard", data);
