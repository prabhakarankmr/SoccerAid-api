export interface AuthenticatedUser {
  id: string;
  phone: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}
