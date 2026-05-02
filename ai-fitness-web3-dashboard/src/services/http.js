import axios from "axios";

const http = axios.create({
  baseURL: "/api",
  timeout: 4000,
});

export default http;
