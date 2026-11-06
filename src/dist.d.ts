declare module "*/dist/server/server.js" {
  const entry: { fetch: (request: Request) => Promise<Response> };
  export default entry;
}
