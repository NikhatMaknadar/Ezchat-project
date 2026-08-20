import axios from "axios";

export const getUserInfo = () => {
  try {
    return JSON.parse(localStorage.getItem("userInfo") || "null");
  } catch {
    return null;
  }
};

export const authConfig = () => {
  const user = getUserInfo();
  return {
    headers: {
      Authorization: `Bearer ${user?.token || ""}`,
      "Content-Type": "application/json",
    },
  };
};

export const api = axios.create({
  baseURL: "/api",
});
