import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:3000", // NestJS backend
});

export default API;