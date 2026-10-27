import { Logger } from 'pino';

declare global {
  namespace Express {
    interface Request {
      log?: Logger;
      /** UUID do usuário, preenchido pelo middleware `userContext`. */
      userId?: string;
    }
  }
}

export {};
