import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { foto } from "./foto";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/foto",
  method: "GET",
  handler: foto,
});

export default http;
